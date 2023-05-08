import express from 'express';
import * as fs from 'fs';
import * as http from 'http';
import { basename, dirname, join } from 'path';
import { getPortPromise } from 'portfinder';
import * as socketio from 'socket.io';
import * as vscode from 'vscode';
import { FileNameHash } from '../types';
import { hashFileName } from '../utils/FileUtil';
import { VSwaggerParser } from './vSwaggerParser';

enum WebSocketEvents {
    connection = 'connection',
    fileLoad = 'load',
    fileUpdate = 'update',
}

type FileLoadPayload = {
    fileNameHash: FileNameHash;
    basename: string;
};

const DEFAULT_HOST = 'localhost';
const DEFAULT_PORT = 18512;

type FileLoadCallbackFunc = (jsonSpec: object) => void;
export class VServer {
    private host: string = DEFAULT_HOST;
    private port: number = DEFAULT_PORT;
    private httpServer: http.Server;
    private websocketServer: socketio.Server;

    private serverRunning = false;
    private vSwaggerParser: VSwaggerParser;

    private constructor() {
        // TODO: validate the port
        this.port = vscode.workspace.getConfiguration('v-swagger').defaultPort ?? DEFAULT_PORT;

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
            // select an available port
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
        this.registerFileChangeListener(fileName);
        const uri = vscode.Uri.joinPath(
            vscode.Uri.parse(`http://${this.host}:${this.port}`),
            hashFileName(fileName),
            basename(fileName)
        );
        console.info(`v-swagger server: serve page for %s at %s`, fileName, uri);
        return uri;
    }

    private registerFileChangeListener(fileName: string) {
        console.info(`v-swagger server: create watcher for file - %s`, fileName);
        // for files not in opened workspace folders, must be specified in such a RelativePattern way
        // for files in opened workspace folders, this also works
        const fileNameInRelativeWay = new vscode.RelativePattern(
            vscode.Uri.file(dirname(fileName)),
            basename(fileName)
        );
        const watcher = vscode.workspace.createFileSystemWatcher(fileNameInRelativeWay);
        watcher.onDidChange(async (uri) => {
            console.info(`v-swagger server: file %s changed, notify clients`, uri);
            await this.vSwaggerParser.parse(fileName);
            this.websocketServer
                .to(hashFileName(fileName))
                .emit(WebSocketEvents.fileUpdate, this.getFileContent(hashFileName(fileName), basename(fileName)));
        });
    }
}
