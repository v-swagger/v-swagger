import SwaggerParser from '@apidevtools/swagger-parser';
import { readFile } from 'fs/promises';
import * as YAML from 'js-yaml';
import { IJsonSchema, OpenAPI } from 'openapi-types';
import { basename, dirname, resolve } from 'path';
import * as vscode from 'vscode';
import { VCache } from '../cache/vCache';
import { VServer } from '../server/vServer';
import { FileNameHash, RewriteConfig } from '../types';
import { hashFileName } from '../utils/fileUtil';
import { PathRewriter } from './pathRewriter';

export class VParser {
    private rewriter: PathRewriter;
    private hash: FileNameHash;
    constructor(rewriteConfig: RewriteConfig, readonly fileName: string) {
        this.rewriter = new PathRewriter(rewriteConfig);
        this.hash = hashFileName(fileName);
        this.registerFileChangeListener();
    }

    public async parse(): Promise<vscode.Uri> {
        try {
            let activatedYaml = (await readFile(this.fileName)).toString();
            if (this.rewriter.isApplicable()) {
                activatedYaml = this.rewriter.rewrite(activatedYaml);
            }

            const schema = YAML.load(activatedYaml) as OpenAPI.Document;

            const parsedSchema = await this.dereference(schema);

            VCache.set(this.hash, parsedSchema);

            // todo: watch change & notify subscribers
            // this.registerFileChangeListener(this.this.fileName);
            return this.getPreviewUrl();
        } catch (e) {
            console.error(`[v-parser]: gets an error when parsing yaml: %j`, e);
            throw e;
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

    private async dereference(schema: OpenAPI.Document): Promise<OpenAPI.Document> {
        try {
            this.resolveRefs(schema as unknown as IJsonSchema);
            schema = await SwaggerParser.dereference(schema, {
                dereference: {
                    circular: true,
                },
            });
        } catch (e) {
            console.error(`[v-parser]: dereference failed due to %s`, e);
        }

        return schema;
    }

    private resolveRefs(schema: IJsonSchema) {
        if (typeof schema !== 'object') {
            return;
        }

        for (const [key, value] of Object.entries(schema)) {
            if (key === '$ref') {
                // fixme: maybe apply rewrite rules here?
                schema[key] = this.resolveRefPath(value);
            } else {
                this.resolveRefs(value);
            }
        }
    }

    private resolveRefPath(ref: string) {
        if (ref.startsWith('#/')) {
            return ref;
        } else {
            console.info(`[v-parser]: resolving path -> %s`, ref);
            return resolve(dirname(this.fileName), ref);
        }
    }
}
