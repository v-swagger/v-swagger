import express from 'express';
import * as fs from 'fs';
import * as http from 'http';
import * as ip from 'ip';
import { join } from 'path';
import { getPortPromise } from 'portfinder';
import { Socket, Server as SocketServer } from 'socket.io';
import * as vscode from 'vscode';
import { VCache } from '../cache/vCache';
import { VParser } from '../parser/vParser';
import { FileNameHash, WebSocketEvents } from '../types';
import { isRemoteWorkspace, isRevalidationRequired } from '../utils/fileUtil';

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
        this.host = isRemoteWorkspace() ? ip.address() : DEFAULT_HOST;

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

    private configureHttpServer() {
        const app = express();
        app.use('/static', express.static(join(__dirname, '..', '..', 'node_modules'))); // fixme: potential security issue
        app.use('/:fileNameHash/:basename', (req: express.Request, res: express.Response) => {
            try {
                VCache.setValidationState(req.params.fileNameHash, isRevalidationRequired(req.headers));
                const htmlContent = fs
                    .readFileSync(join(__dirname, '..', '..', 'static', 'index.html'))
                    .toString('utf-8')
                    .replace('%FILE_NAME%', req.params.basename)
                    .replace('%FILE_HASH%', req.params.fileNameHash);
                res.setHeader('Content-Type', 'text/html');
                res.send(htmlContent);
            } catch (e) {
                vscode.window.showErrorMessage(
                    `Cannot preview file ${req.params.basename} due to an error: \n ${(e as Error)?.message}`
                );
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
            this.httpServer.listen(this.port, this.host, () => {
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
            console.error(`[v-server]: get an error during synchronization: %s`, e);
            vscode.window.showErrorMessage(
                `Cannot synchronize changes of ${baseFileName} due to an error: \n ${(e as Error)?.message}`
            );
        }
    }
}
