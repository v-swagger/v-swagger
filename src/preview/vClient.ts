import * as vscode from 'vscode';

import { BrowserPreviewer } from './browserPreviewer';

export class VClient {
    constructor(readonly uri: vscode.Uri) {}

    public async preview() {
        console.info(`v-swagger client: going to open %s in default browser`, this.uri);
        const browserPreview = new BrowserPreviewer(this.uri.toString());
        await browserPreview.preview();
    }
}
