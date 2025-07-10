import express from 'express';
import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import { getPortPromise } from 'portfinder';
import { Socket, Server as SocketServer } from 'socket.io';
import * as vscode from 'vscode';
import { VCache } from '../cache/vCache';
import { logger } from '../logger/vLogger';
import { VParser } from '../parser/vParser';
import { FileNameHash, IOperationErrorContext, WebSocketEvents } from '../types';
import { ErrorCategory, ErrorHandler, VError } from '../utils/errorHandler';
import { getExternalAddress, isRevalidationRequired } from '../utils/utils';

type FileLoadPayload = {
    fileNameHash: FileNameHash;
    basename: string;
};

const DEFAULT_HOST = 'localhost';
const DEFAULT_PORT = 18512;

export class VServer {
    private host: string = DEFAULT_HOST;
    private port: number = DEFAULT_PORT;
    private readonly httpServer: http.Server;
    private readonly websocketServer: SocketServer;

    private serverRunning = false;

    private constructor() {
        // TODO: validate the port
        this.port = vscode.workspace.getConfiguration('v-swagger').defaultPort ?? DEFAULT_PORT;
        this.host = vscode.workspace.getConfiguration('v-swagger').defaultHost ?? this.getDefaultHost();
        logger.info('[VServer] Initializing with host: %s, port: %d', this.host, this.port);

        const app = this.configureHttpServer();
        this.httpServer = http.createServer(app);
        logger.info('[VServer] HTTP server created');

        this.websocketServer = new SocketServer(this.httpServer);
        logger.info('[VServer] WebSocket server created');
        this.initializeWebsocketServer();
    }

    private static instance: VServer;
    public static getInstance(): VServer {
        if (!VServer.instance) {
            VServer.instance = new VServer();
        }

        return VServer.instance;
    }

    private getDefaultHost(): string {
        return this.isRemoteWorkspace() ? getExternalAddress() : DEFAULT_HOST;
    }

    private isRemoteWorkspace(): boolean {
        const manifestPath = path.join(__dirname, '..', '..', 'package.json');
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        const vSwaggerId = `${manifest.publisher}.${manifest.name}`;
        const currentExt = vscode.extensions.getExtension(vSwaggerId);
        return currentExt?.extensionKind === vscode.ExtensionKind.Workspace;
    }

    private configureHttpServer() {
        logger.info('[VServer] Configuring HTTP server');
        const app = express();

        // Only handle specific routes and return 404 for everything else

        // Route 1: Static files
        app.use('/static', express.static(path.join(__dirname, '..', '..', 'node_modules'))); // fixme: potential security issue
        logger.info('[VServer] Static route configured for node_modules');

        // Route 2: File preview with hash and basename
        app.use('/:fileNameHash/:basename', (req: express.Request, res: express.Response) => {
            try {
                if (!this.isValidRequest(req, res)) {
                    return;
                }
                VCache.setValidationState(req.params.fileNameHash, isRevalidationRequired(req.headers));
                const htmlContent = fs
                    .readFileSync(path.join(__dirname, '..', '..', 'static', 'index.html'))
                    .toString('utf-8')
                    .replace('%FILE_NAME%', req.params.basename)
                    .replace('%FILE_HASH%', req.params.fileNameHash);
                res.setHeader('Content-Type', 'text/html');
                res.send(htmlContent);
            } catch (e) {
                const error = e as Error;
                const errorContext: IOperationErrorContext = {
                    fileNameHash: req.params.fileNameHash,
                    basename: req.params.basename,
                    operation: 'file preview',
                };

                // If the error is already a VError, use it directly
                const vError = error instanceof VError ? error : ErrorHandler.processError(error, errorContext);

                vscode.window.showErrorMessage(`Cannot preview file ${req.params.basename}`, {
                    detail: vError.format(),
                    modal: true,
                });
                res.status(400).send({
                    error: vError.message,
                    detail: vError.format(),
                });
            }
        });

        return app;
    }

    private initializeWebsocketServer() {
        this.websocketServer.on(WebSocketEvents.Connection, (socket: Socket) => {
            logger.info('[VServer] on websocket connection event');
            socket.on(WebSocketEvents.Load, async (data: FileLoadPayload) => {
                const hash = data.fileNameHash;
                logger.info('[VServer] on websocket fileLoad event for file name hash - %s, join room of it', hash);
                socket.join(hash);
                await this.pushJsonSpec(hash, data.basename);
            });
        });
    }

    public async start() {
        if (!this.serverRunning) {
            logger.info('[VServer] Starting server');
            // select an available port
            this.port = await getPortPromise({ port: this.port });
            logger.info('[VServer] Found available port: %d', this.port);
            this.httpServer.listen(this.port, '0.0.0.0', () => {
                this.serverRunning = true;
                logger.info('[VServer] server is listening on: http://%s:%s', this.host, this.port);
            });
        }
    }

    public getServerUri(): vscode.Uri {
        return vscode.Uri.parse(`http://${this.host}:${this.port}`);
    }

    public stop() {
        this.httpServer.close();
        this.serverRunning = false;
        logger.info('[VServer] server is stopping');
    }

    private async pushJsonSpec(hash: FileNameHash, baseFileName: string) {
        logger.info('[VServer] Pushing JSON spec for %s with hash %s', baseFileName, hash);
        try {
            if (!VCache.has(hash)) {
                // todo: UI display errors?
                logger.info('[VServer] Cannot find cached content for hash: %s', hash);
                throw new Error(`cannot load file content with hash: ${hash}`);
            }
            const { fileName } = VCache.get(hash)!;
            if (VCache.mustRevalidate(hash)) {
                const vParser = VParser.getInstance(fileName);
                await vParser.parse();
            }
            // schema is fresh after revalidation
            const { schema } = VCache.get(hash)!;
            logger.info('[VServer] Emitting schema to room: %s', hash);
            this.websocketServer.to(hash).emit(WebSocketEvents.Push, schema);
            logger.info('[VServer] Schema successfully pushed to clients');
        } catch (e) {
            const error = e as Error;
            const contextInfo: IOperationErrorContext = {
                fileNameHash: hash,
                fileName: VCache.has(hash) ? VCache.get(hash)?.fileName : undefined,
                basename: baseFileName,
                operation: 'schema synchronization',
            };

            // If the error is already a VError, use it directly
            const vError = error instanceof VError ? error : ErrorHandler.processError(error, contextInfo);

            logger.error('[VServer] Error during synchronization: %s', error.message);

            vscode.window.showErrorMessage(`Cannot synchronize changes of ${baseFileName}`, {
                detail: vError.format(),
                modal: true,
            });
        }
    }

    // invalid requests with such format:
    // /hash/basename -> hash is a 8 characters long string. e.g. /7a55a76d/catalog-import-shared.yaml  basename ends with .yaml or .yml or .json
    // e.g. /7a55a76/catalog-import-shared.yaml is invalid
    // e.g. /7a55a76/catalog/import-shared.yaml is invalid
    // e.g. /a55a76dx/catalog-import-shared.yaml.json is valid
    // e.g. /a55a76dx/catalog-import-shared.yaml is valid
    private isValidRequest(req: express.Request, res: express.Response): boolean {
        const { fileNameHash, basename } = req.params;
        const requestPath = req.originalUrl || `/${fileNameHash}/${basename}`;

        const error = new Error(
            `Invalid request format for path '${requestPath}': only support the path like /hash/file.yaml or /hash/file.json`
        );
        // Check if hash is exactly 8 characters (invalid)
        if (fileNameHash.length !== 8) {
            logger.warn('[VServer] Rejected request with 6-character hash: %s, path: %s', fileNameHash, requestPath);
            const vErr = new VError(
                error,
                error.message,
                ErrorCategory.FileNotFound,
                undefined,
                `${fileNameHash} is not a valid hash with 8 chars`,
                { fileNameHash, basename }
            );
            res.status(404).send(vErr.format());
            return false;
        }

        // Check if basename contains path segments (invalid)
        if (basename.includes('/')) {
            logger.warn(
                '[VServer] Rejected request with path segments in basename: %s, path: %s',
                basename,
                requestPath
            );
            const vErr = new VError(
                error,
                error.message,
                ErrorCategory.FileNotFound,
                undefined,
                'Remove any path segments (/) from the basename.',
                { fileNameHash, basename }
            );
            res.status(404).send(vErr.format());
            return false;
        }

        // Check if basename has valid extension (.yaml, .yml, or .json)
        const validExtensionPattern = /\.(yaml|yml|json)$/i;
        if (!validExtensionPattern.test(basename)) {
            logger.warn('[VServer] Rejected request with invalid file extension: %s, path: %s', basename, requestPath);
            const vErr = new VError(
                error,
                error.message,
                ErrorCategory.FileNotFound,
                undefined,
                'Use a file with a .yaml, .yml, or .json extension.',
                { fileNameHash, basename }
            );
            res.status(404).send(vErr.format());
            return false;
        }

        // Request is valid
        logger.info('[VServer] Validated request for path: %s', requestPath);
        return true;
    }
}
