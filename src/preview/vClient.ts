import * as vscode from 'vscode';

import { BrowserPreviewer } from './viewer/browserPreviewer';
import { WebviewPanelPreviewer } from './viewer/webviewPanelPreviewer';

export class VClient {
    constructor(readonly uri: vscode.Uri, readonly fileName: string) {}

    public async preview() {
        const previewInBrowser: boolean = vscode.workspace.getConfiguration('swaggerViewer').previewInBrowser;
        if (previewInBrowser) {
            console.info(`v-swagger client: going to open %s in default browser`, this.uri);
            const previewer = new BrowserPreviewer(this.uri.toString(), this.fileName);
            await previewer.preview();
        } else {
            console.info(`v-swagger client: going to open %s in webview panel`, this.uri);
            const previewer = new WebviewPanelPreviewer(this.uri.toString(), this.fileName);
            await previewer.preview();
        }
    }
}
