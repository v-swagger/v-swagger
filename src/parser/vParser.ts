import SwaggerParser from '@apidevtools/swagger-parser';
import * as _ from 'lodash';
import { OpenAPI } from 'openapi-types';
import { basename, dirname } from 'path';
import * as vscode from 'vscode';
import { VCache } from '../cache/vCache';
import { VServer } from '../server/vServer';
import { FileNameHash, RewriteConfig } from '../types';
import { hashFileName } from '../utils/fileUtil';
import { PathRewriter } from './pathRewriter';

export class VParser {
    private seen: Set<FileNameHash> = new Set();
    private hash: FileNameHash;
    constructor(readonly rewriteConfig: RewriteConfig, readonly fileName: string) {
        this.registerFileChangeListener();
        this.hash = hashFileName(fileName);
    }

    public async parse(): Promise<vscode.Uri> {
        try {
            if (!VCache.has(this.hash)) {
                await this.resolve(this.fileName);
                // todo: watch change & notify subscribers
            }
        } catch (e) {
            console.error(`[v-parser]: gets an error when parsing yaml: %j`, e);
        }
        return this.getPreviewUrl();
    }

    private async resolve(fileName: string) {
        const hash = hashFileName(fileName);
        // the freshness is maintained by File Watcher
        if (this.seen.has(hash) || VCache.has(hash)) {
            return;
        }
        try {
            // mark as resolved in advance nevertheless there is an error
            this.seen.add(hash);
            let parsedSchema = await SwaggerParser.parse(fileName);

            const rewriter = new PathRewriter(this.rewriteConfig, fileName);
            parsedSchema = rewriter.rewrite(parsedSchema);
            for (const ref of rewriter.getAllRefs()) {
                await this.resolve(ref);
            }

            // todo: circular detection

            try {
                this.dereferenceInternal(parsedSchema);
                this.dereferenceExternal(parsedSchema);
            } finally {
                VCache.set(hash, parsedSchema);
            }
        } catch (e) {
            console.error(`[v-parser]: gets an error when resolving %s: %j`, fileName, e);
        }
    }

    private registerFileChangeListener() {
        console.info(`[v-parser]: create watcher for file - %s`, this.fileName);
        // for files not in opened workspace folders, must be specified in such a RelativePattern way
        // for files in opened workspace folders, this also works
        const fileNameInRelativeWay = new vscode.RelativePattern(
            vscode.Uri.file(dirname(this.fileName)),
            basename(this.fileName)
        );
        const watcher = vscode.workspace.createFileSystemWatcher(fileNameInRelativeWay);
        watcher.onDidChange(async (uri) => {
            VCache.delete(this.hash);
            console.info(`[v-parser]: file %s changed, notify clients`, uri);
            await this.parse();
            // todo: decouple from VServer later
            VServer.getInstance().pushJsonSpec(this.hash);
        });
    }

    private getPreviewUrl(): vscode.Uri {
        const uri = vscode.Uri.joinPath(VServer.getInstance().getServerUri(), this.hash, basename(this.fileName));
        console.info(`[v-parser]: VServer serves page for %s at %s`, this.fileName, uri);
        return uri;
    }

    private async dereferenceInternal(schema: OpenAPI.Document) {
        try {
            await SwaggerParser.dereference(schema, {
                resolve: {
                    external: false,
                },
                dereference: {
                    circular: true,
                },
            });
        } catch (e) {
            console.error(`[v-parser]: dereference failed due to %s`, e);
        }
    }
    // dereference external
    private dereferenceExternal(schema: OpenAPI.Document) {
        try {
            if (typeof schema !== 'object') {
                return;
            }

            for (const [key, value] of Object.entries(schema)) {
                if (key === '$ref' && !key.startsWith('#/')) {
                    const components = value.split('#/');
                    const hash = hashFileName(components[0]);
                    if (!VCache.has(hash)) {
                        continue;
                    } else {
                        const refSchema = VCache.get(hash);
                        const refPath = components[1].replaceAll('/', '.');
                        const resolvedRef = _.get(refSchema, refPath);
                        // @ts-expect-error TS(7053)
                        delete schema.$ref;
                        _.assign(schema, resolvedRef);
                    }
                } else {
                    this.dereferenceExternal(value);
                }
            }
        } catch (e) {
            console.error(`[v-parser]: dereference failed due to %s`, e);
        }
    }
}
