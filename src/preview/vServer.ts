import express from 'express';
import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import { getPortPromise } from 'portfinder';
import * as socketio from 'socket.io';
import * as vscode from 'vscode';
import { FileNameHash } from '../types';
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

    constructor() {
        this.vSwaggerParser = VSwaggerParser.getInstance();
        const app = express();
        app.use(express.static(path.join(__dirname, '..', '..', 'static')));
        app.use('/static', express.static(path.join(__dirname, '..', '..', 'node_modules')));
        app.use('/:fileNameHash/:basename', (req: express.Request, res: express.Response) => {
            const htmlContent = fs
                .readFileSync(path.join(__dirname, '..', '..', 'static', 'index.html'))
                .toString('utf-8')
                .replace('%FILE_NAME%', req.params.basename)
                .replace('%FILE_HASH%', req.params.fileNameHash);
            res.setHeader('Content-Type', 'text/html');
            res.send(htmlContent);
        });

        this.httpServer = http.createServer(app);
        this.websocketServer = new socketio.Server(this.httpServer);
        this.websocketServer.on(WebSocketEvents.connection, (socket: socketio.Socket) => {
            socket.on(WebSocketEvents.fileLoad, (data: FileLoadPayload, callback: FileLoadCallbackFunc) => {
                const hash = data.fileNameHash;
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
            });
        }
    }

    public getServerUri(): vscode.Uri {
        return vscode.Uri.parse(`http://${this.host}:${this.port}`);
    }

    public stop() {
        this.httpServer.close();
        this.serverRunning = false;
    }
}
