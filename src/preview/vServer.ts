import express from 'express';
import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import { getPortPromise } from 'portfinder';
import * as socketio from 'socket.io';
import * as vscode from 'vscode';
import { FileNameHash } from '../types';
import { hashFileName } from '../utils/FileUtil';
import { VSwaggerParser } from './vSwaggerParser';

const SERVER_PORT = vscode.workspace.getConfiguration('swaggerViewer').defaultPort || 18512;

enum WebSocketEvents {
    connection = 'connection',
    fileLoad = 'load',
}

type FileLoadPayload = {
    fileNameHash: FileNameHash;
    basename: string;
};

type FileLoadCallbackFunc = (jsonSpec: object) => void;
export class VServer {
    private host: string = '';
    private port: number = SERVER_PORT;
    private httpServer: http.Server;
    private websocketServer: socketio.Server;

    private serverRunning: boolean = false;
    private vSwaggerParser: VSwaggerParser;

    private constructor() {
        this.vSwaggerParser = VSwaggerParser.getInstance();

        const app = this.configureHttpServer();
        this.httpServer = http.createServer(app);

        this.websocketServer = new socketio.Server(this.httpServer);
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
        app.use('/static', express.static(path.join(__dirname, '..', '..', 'node_modules'))); // fixme: potential security issue
        app.use('/:fileNameHash/:basename', (req: express.Request, res: express.Response) => {
            const htmlContent = fs
                .readFileSync(path.join(__dirname, '..', '..', 'static', 'index.html'))
                .toString('utf-8')
                .replace('%FILE_NAME%', req.params.basename)
                .replace('%FILE_HASH%', req.params.fileNameHash);
            res.setHeader('Content-Type', 'text/html');
            res.send(htmlContent);
        });
        return app;
    }

    private initializeWebsocketServer() {
        this.websocketServer.on(WebSocketEvents.connection, (socket: socketio.Socket) => {
            console.info('v-swagger server: on websocket connection event');
            socket.on(WebSocketEvents.fileLoad, (data: FileLoadPayload, callback: FileLoadCallbackFunc) => {
                const hash = data.fileNameHash;
                console.info(
                    `v-swagger server: on websocket fileLoad event for file name hash - %s, join room of it`,
                    hash
                );
                socket.join(hash);
                const jsonSpec = this.getFileContent(hash, data.basename);
                callback(jsonSpec);
            });
        });
    }

    private getFileContent(hash: FileNameHash, basename: string): object {
        const content = this.vSwaggerParser.getByFileNameHash(hash);
        if (!content) {
            const msg = `cannot load file content: ${basename}`;
            console.error(msg);
            throw new Error(msg);
        }
        return content;
    }

    public async start() {
        if (!this.serverRunning) {
            // todo: make host and port configurable
            this.host = 'localhost';
            this.port = await getPortPromise({ port: this.port });
            this.httpServer.listen(this.port, this.host, () => {
                this.serverRunning = true;
                console.info(`v-swagger server: listening on: http://%s:%s`, this.host, this.port);
            });
        }
    }

    public stop() {
        this.httpServer.close();
        this.serverRunning = false;
        console.info(`v-swagger server: server is stopping`);
    }

    public async serve(fileName: string): Promise<vscode.Uri> {
        await this.vSwaggerParser.parse(fileName);

        const uri = vscode.Uri.joinPath(
            vscode.Uri.parse(`http://${this.host}:${this.port}`),
            hashFileName(fileName),
            path.basename(fileName)
        );
        console.info(`v-swagger server: serve counter swagger ui for %s at %s`, fileName, uri);
        return uri;
    }
}
