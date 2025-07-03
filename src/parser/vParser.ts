import SwaggerParser from '@apidevtools/swagger-parser';
import * as _ from 'lodash';
import { OpenAPI } from 'openapi-types';
import * as path from 'path';
import { io } from 'socket.io-client';
import * as vscode from 'vscode';
import { VCache } from '../cache/vCache';
import { VServer } from '../server/vServer';
import { $RefSchema, FileNameHash, WebSocketEvents } from '../types';
import { hashFileName, isInternal$Ref, isValid$Ref, normalize$Ref } from '../utils/utils';
import { PathRewriter } from './pathRewriter';

export class VParser {
    private seen: Set<FileNameHash> = new Set();
    private readonly watcher: vscode.FileSystemWatcher;

    private constructor(
        readonly fileName: string,
        readonly hash: FileNameHash
    ) {
        // for files not in opened workspace folders, must be specified in such a RelativePattern way
        // for files in opened workspace folders, this also works
        const fileNameInRelativeWay = new vscode.RelativePattern(
            vscode.Uri.file(path.dirname(this.fileName)),
            path.basename(this.fileName)
        );
        this.watcher = vscode.workspace.createFileSystemWatcher(fileNameInRelativeWay);

        this.registerFileChangeListener();
    }

    private static socket = io(VServer.getInstance().getServerUri().toString());
    private static instances: Map<FileNameHash, VParser> = new Map();

    static getInstance(fileName: string): VParser {
        const hash = hashFileName(fileName);
        if (!VParser.instances.has(hash)) {
            VParser.instances.set(hash, new VParser(fileName, hash));
        }
        return VParser.instances.get(hash)!;
    }

    public async parse(): Promise<vscode.Uri> {
        this.seen.clear();
        await this.resolve(this.fileName);
        // todo: watch change & notify subscribers
        return this.getPreviewUrl();
    }

    public destroy(fileName: string) {
        this.clearAllListeners();
        VParser.instances.delete(hashFileName(fileName));
    }

    private async resolve(fileName: string) {
        const hash = hashFileName(fileName);
        // the freshness is maintained by File Watcher
        if (this.seen.has(hash) || (VCache.has(hash) && !VCache.mustRevalidate(hash))) {
            return;
        }
        try {
            // mark as resolved in advance nevertheless there is an error
            this.seen.add(hash);
            let parsedSchema = await SwaggerParser.parse(fileName);
            // apply rewrite rule changes by not saving to singleton
            const rewriteConfig = vscode.workspace.getConfiguration('v-swagger').pathRewrite;
            const rewriter = new PathRewriter(rewriteConfig, fileName);
            parsedSchema = rewriter.rewrite(parsedSchema);
            for (const ref of rewriter.getAllRefs()) {
                await this.resolve(ref);
            }
            const dereferenced = await this.dereference(parsedSchema);
            VCache.set(hash, { schema: dereferenced, fileName, mustRevalidate: false });
        } catch (e) {
            console.error(`[v-parser]: gets an error when resolving %s: %o`, fileName, e);
        }
    }

    private async dereference(schema: OpenAPI.Document): Promise<OpenAPI.Document> {
        const dereferenced = await this.dereferenceInternal(schema);
        this.dereferenceExternal(dereferenced, new WeakSet());
        return dereferenced;
    }

    private async dereferenceInternal(schema: OpenAPI.Document): Promise<OpenAPI.Document> {
        try {
            return await SwaggerParser.dereference(schema, {
                resolve: {
                    external: false,
                },
                dereference: {
                    circular: 'ignore',
                },
            });
        } catch (e) {
            console.error(`[v-parser]: dereference internal reference failed due to %s`, e);
            throw e;
        }
    }

    private dereferenceExternal(schema: object, resolved: WeakSet<object>) {
        try {
            if (!_.isObject(schema) || resolved.has(schema)) {
                return schema;
            }
            resolved.add(schema);

            for (const [key, value] of Object.entries(schema)) {
                if (isValid$Ref(key, value) && !isInternal$Ref(key, value)) {
                    this.resolveExternal$Ref(schema, value);
                } else {
                    this.dereferenceExternal(value, resolved);
                }
            }
        } catch (e) {
            console.error(`[v-parser]: dereference external reference failed due to %s`, e);
        }
    }

    private resolveExternal$Ref(schema: $RefSchema, value: string) {
        const { absolutePath, hashPath } = normalize$Ref(value);
        const hash = hashFileName(absolutePath);
        if (!VCache.has(hash)) {
            return;
        }
        const { schema: refSchema } = VCache.get(hash)!;
        const refPath = hashPath.replaceAll(path.posix.sep, '.');
        const resolvedRef = _.get(refSchema, refPath);
        delete schema.$ref;
        _.assign(schema, resolvedRef);
    }

    private registerFileChangeListener() {
        console.info(`[v-parser]: create watcher for file - %s`, this.fileName);
        this.watcher.onDidChange(async (uri) => {
            const baseFileName = path.basename(this.fileName);
            await vscode.window.withProgress(
                {
                    title: `Synchronize changes of ${baseFileName} to preview client`,
                    location: vscode.ProgressLocation.Notification,
                },
                async () => {
                    VCache.setValidationState(this.hash, true);
                    console.info(`[v-parser]: file %s changed, notify clients`, uri);
                    // ask client to load data
                    VParser.socket.emit(WebSocketEvents.Load, {
                        basename: baseFileName,
                        fileNameHash: this.hash,
                    });
                }
            );
        });
    }

    private clearAllListeners() {
        this.watcher.dispose();
    }

    private getPreviewUrl(): vscode.Uri {
        const uri = vscode.Uri.joinPath(VServer.getInstance().getServerUri(), this.hash, path.basename(this.fileName));
        console.info(`[v-parser]: VServer serves page for %s at %s`, this.fileName, uri);
        return uri;
    }
}
