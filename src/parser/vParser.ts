import SwaggerParser from '@apidevtools/swagger-parser';
import * as _ from 'lodash';
import { OpenAPI } from 'openapi-types';
import * as path from 'path';
import { io } from 'socket.io-client';
import * as vscode from 'vscode';
import { VCache } from '../cache/vCache';
import { VServer } from '../server/vServer';
import {
    $RefSchema,
    FileNameHash,
    IFileErrorContext,
    IReferenceErrorContext,
    ISchemaErrorContext,
    WebSocketEvents,
} from '../types';
import { ErrorHandler, VError } from '../utils/errorHandler';
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
            const error = e as Error;

            // If the error is already a VError, use it directly
            const errorContext: IFileErrorContext = {
                fileName: fileName,
                fileHash: hash,
                referenceValue: fileName, // Include the full path for better error context
            };
            const vError = error instanceof VError ? error : ErrorHandler.processError(error, errorContext);

            console.error(`[v-parser]: Error when resolving ${fileName}:\n${vError.format()}`);

            // Throw the enhanced error directly
            throw vError;
        }
    }

    private async dereference(schema: OpenAPI.Document): Promise<OpenAPI.Document> {
        try {
            const dereferenced = await this.dereferenceInternal(schema);
            this.dereferenceExternal(dereferenced, new WeakSet());
            return dereferenced;
        } catch (error) {
            // Log the error with full context but always rethrow it
            console.error(`[v-parser]: Error in dereference process for ${this.fileName}:`, error);
            throw error;
        }
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
            // Use the ErrorHandler to generate an enhanced error message for schema validation issues
            const error = e as Error;
            const errorContext: ISchemaErrorContext = {
                fileName: this.fileName,
                schemaType: 'OpenAPI',
            };

            // Process the error to enhance it with context
            const vError = ErrorHandler.processError(error, errorContext);

            console.error(`[v-parser]: Error when dereferencing schema:\n${vError.format()}`);

            // Throw the enhanced error directly
            throw vError;
        }
    }

    private dereferenceExternal(schema: object, resolved: WeakSet<object>) {
        if (!_.isObject(schema) || resolved.has(schema)) {
            return schema;
        }
        resolved.add(schema);

        for (const [key, value] of Object.entries(schema)) {
            if (isValid$Ref(key, value) && !isInternal$Ref(key, value)) {
                try {
                    this.resolveExternal$Ref(schema, value);
                } catch (e) {
                    // Process the error but re-throw it to propagate to caller
                    const error = e as Error;
                    const errorContext: IReferenceErrorContext = {
                        fileName: this.fileName,
                        referenceType: 'external',
                        referenceValue: value,
                        sourceFile: this.fileName,
                    };

                    // Process the error to enhance it with context
                    const vError = ErrorHandler.processError(error, errorContext);

                    console.error(
                        `[v-parser]: Error when dereferencing external reference "${value}":\n${vError.format()}`
                    );

                    // Throw the enhanced error directly
                    throw vError;
                }
            } else {
                this.dereferenceExternal(value, resolved);
            }
        }
        return schema;
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
