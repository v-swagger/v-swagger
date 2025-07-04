import express from 'express';
import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import { getPortPromise } from 'portfinder';
import { Socket, Server as SocketServer } from 'socket.io';
import * as vscode from 'vscode';
import { VCache } from '../cache/vCache';
import { VParser } from '../parser/vParser';
import { FileNameHash, IOperationErrorContext, WebSocketEvents } from '../types';
import { ErrorHandler, VError } from '../utils/errorHandler';
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

        const app = this.configureHttpServer();
        this.httpServer = http.createServer(app);

        this.websocketServer = new SocketServer(this.httpServer);
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
        const app = express();
        app.use('/static', express.static(path.join(__dirname, '..', '..', 'node_modules'))); // fixme: potential security issue
        app.use('/:fileNameHash/:basename', (req: express.Request, res: express.Response) => {
            try {
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
            }
        });
        return app;
    }

    private initializeWebsocketServer() {
        this.websocketServer.on(WebSocketEvents.Connection, (socket: Socket) => {
            console.info(`[v-server]: on websocket connection event`);
            socket.on(WebSocketEvents.Load, async (data: FileLoadPayload) => {
                const hash = data.fileNameHash;
                console.info(`[v-server]: on websocket fileLoad event for file name hash - %s, join room of it`, hash);
                socket.join(hash);
                await this.pushJsonSpec(hash, data.basename);
            });
        });
    }

    public async start() {
        if (!this.serverRunning) {
            // select an available port
            this.port = await getPortPromise({ port: this.port });
            this.httpServer.listen(this.port, '0.0.0.0', () => {
                this.serverRunning = true;
                console.info(`[v-server]: server is listening on: http://%s:%s`, this.host, this.port);
            });
        }
    }

    public getServerUri(): vscode.Uri {
        return vscode.Uri.parse(`http://${this.host}:${this.port}`);
    }

    public stop() {
        this.httpServer.close();
        this.serverRunning = false;
        console.info(`[v-server]: server is stopping`);
    }

    private async pushJsonSpec(hash: FileNameHash, baseFileName: string) {
        try {
            if (!VCache.has(hash)) {
                // todo: UI display errors?
                throw new Error(`cannot load file content with hash: ${hash}`);
            }
            const { fileName } = VCache.get(hash)!;
            if (VCache.mustRevalidate(hash)) {
                const vParser = VParser.getInstance(fileName);
                await vParser.parse();
            }
            // schema is fresh after revalidation
            const { schema } = VCache.get(hash)!;
            this.websocketServer.to(hash).emit(WebSocketEvents.Push, schema);
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

            console.error(`[v-server]: Error during synchronization:\n${vError.format()}`);

            vscode.window.showErrorMessage(`Cannot synchronize changes of ${baseFileName}`, {
                detail: vError.format(),
                modal: true,
            });
        }
    }
}
