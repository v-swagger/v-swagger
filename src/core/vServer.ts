import express from 'express';
import * as fs from 'fs';
import * as http from 'http';
import { basename, dirname, join } from 'path';
import { getPortPromise } from 'portfinder';
import * as socketio from 'socket.io';
import * as vscode from 'vscode';
import { FileNameHash } from '../types';
import { hashFileName } from '../utils/fileUtil';
import { SwaggerParser } from '../utils/swaggerParser';

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
    private websocketServer: socketio.Server;

    private serverRunning = false;
    private swaggerParser: SwaggerParser;

    private constructor() {
        // TODO: validate the port
        this.port = vscode.workspace.getConfiguration('v-swagger').defaultPort ?? DEFAULT_PORT;

        const rewriteConfig = vscode.workspace.getConfiguration('v-swagger').pathRewrite ?? {};
        this.swaggerParser = new SwaggerParser(rewriteConfig);

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
            console.info(`[v-server]: [v-server]: on websocket connection event`);
            socket.on(WebSocketEvents.load, async (data: FileLoadPayload) => {
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

    public stop() {
        this.httpServer.close();
        this.serverRunning = false;
        console.info(`[v-server]: server is stopping`);
    }

    public async serve(fileName: string): Promise<vscode.Uri> {
        await this.swaggerParser.parse(fileName);
        this.registerFileChangeListener(fileName);
        const uri = vscode.Uri.joinPath(
            vscode.Uri.parse(`http://${this.host}:${this.port}`),
            hashFileName(fileName),
            basename(fileName)
        );
        console.info(`[v-server]: serve page for %s at %s`, fileName, uri);
        return uri;
    }

    private registerFileChangeListener(fileName: string) {
        console.info(`[v-server]: create watcher for file - %s`, fileName);
        // for files not in opened workspace folders, must be specified in such a RelativePattern way
        // for files in opened workspace folders, this also works
        const fileNameInRelativeWay = new vscode.RelativePattern(
            vscode.Uri.file(dirname(fileName)),
            basename(fileName)
        );
        const watcher = vscode.workspace.createFileSystemWatcher(fileNameInRelativeWay);
        watcher.onDidChange(async (uri) => {
            console.info(`[v-server]: file %s changed, notify clients`, uri);
            await this.swaggerParser.parse(fileName);
            this.pushJsonSpec(hashFileName(fileName));
        });
    }

    private async pushJsonSpec(hash: FileNameHash) {
        try {
            const jsonSpec = this.swaggerParser.getByFileNameHash(hash);
            if (!jsonSpec) {
                throw new Error(`cannot load file content with hash: ${hash}`);
            }
            await this.websocketServer.to(hash).emit(WebSocketEvents.push, jsonSpec);
        } catch (e) {
            console.error(`[v-server]: get an error when pushing json spec to ui: %j`, e);
        }
    }
}
