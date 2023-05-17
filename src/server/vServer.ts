import express from 'express';
import * as fs from 'fs';
import * as http from 'http';
import { join } from 'path';
import { getPortPromise } from 'portfinder';
// error in win: Could not find a declaration file for module
// workaround suggested by https://stackoverflow.com/a/55576119/9304616
/* eslint-disable */
// @ts-ignore
import { Socket, Server as SocketServer } from 'socket.io';
/* eslint-enable */
import * as vscode from 'vscode';
import { VCache } from '../cache/vCache';
import { FileNameHash } from '../types';

enum WebSocketEvents {
    connection = 'connection',
    load = 'load',
    push = 'push',
}

type FileLoadPayload = {
    fileNameHash: FileNameHash;
    basename: string;
};

const DEFAULT_HOST = 'localhost';
const DEFAULT_PORT = 18512;

export class VServer {
    private host: string = DEFAULT_HOST;
    private port: number = DEFAULT_PORT;
    private httpServer: http.Server;
    private websocketServer: SocketServer;

    private serverRunning = false;

    private constructor() {
        // TODO: validate the port
        this.port = vscode.workspace.getConfiguration('v-swagger').defaultPort ?? DEFAULT_PORT;

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
            const htmlContent = fs
                .readFileSync(join(__dirname, '..', '..', 'static', 'index.html'))
                .toString('utf-8')
                .replace('%FILE_NAME%', req.params.basename)
                .replace('%FILE_HASH%', req.params.fileNameHash);
            res.setHeader('Content-Type', 'text/html');
            res.send(htmlContent);
        });
        return app;
    }

    private initializeWebsocketServer() {
        this.websocketServer.on(WebSocketEvents.connection, (socket: Socket) => {
            console.info(`[v-server]: on websocket connection event`);
            socket.on(WebSocketEvents.load, (data: FileLoadPayload) => {
                const hash = data.fileNameHash;
                console.info(`[v-server]: on websocket fileLoad event for file name hash - %s, join room of it`, hash);
                socket.join(hash);
                this.pushJsonSpec(hash);
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

    public pushJsonSpec(hash: FileNameHash) {
        try {
            const jsonSpec = VCache.get(hash);
            // decycle
            if (!jsonSpec) {
                throw new Error(`cannot load file content with hash: ${hash}`);
            }
            this.websocketServer.to(hash).emit(WebSocketEvents.push, jsonSpec);
        } catch (e) {
            console.error(`[v-server]: get an error when pushing json spec to ui: %j`, e);
        }
    }
}
