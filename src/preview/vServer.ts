import express from 'express';
import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import { getPortPromise } from 'portfinder';
import * as vscode from 'vscode';

const SERVER_PORT = vscode.workspace.getConfiguration('swaggerViewer').defaultPort || 18512;

const FILE_CONTENT: { [key: string]: any } = {};

export class VServer {
    private host: string = '';
    private port: number = SERVER_PORT;
    private server: http.Server | null = null;

    private serverRunning: boolean = false;

    constructor() {}

    public async start() {
        if (!this.serverRunning) {
            this.host = 'localhost';
            this.port = await getPortPromise({ port: this.port });
            const app = express();
            app.use(express.static(path.join(__dirname, '..', '..', 'static')));
            app.use('/node_modules', express.static(path.join(__dirname, '..', '..', 'node_modules')));
            app.use('/:fileName', (req: express.Request, res: express.Response) => {
                const htmlContent = fs
                    .readFileSync(path.join(__dirname, '..', '..', 'static', 'index.html'))
                    .toString('utf-8')
                    .replace('%FILE_NAME%', req.params.fileName);
                res.setHeader('Content-Type', 'text/html');
                res.send(htmlContent);
            });

            this.server = http.createServer(app);

            app.set('host', this.host);
            app.set('port', this.port);

            this.server.listen(this.port, this.host, () => {
                this.serverRunning = true;
            });
        }
    }

    public getServerUri(): vscode.Uri {
        return vscode.Uri.parse(`http://${this.host}:${this.port}`);
    }

    public stop() {
        this.server?.close();
        this.server = null;
        this.serverRunning = false;
    }
}
