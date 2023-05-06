import * as path from 'path';
import * as vscode from 'vscode';

import assert from 'assert';
import { BrowserPreview } from './browserPreview';

export class VClient {
    constructor(readonly serverUri: vscode.Uri) {}

    public async preview() {
        const browserPreview = new BrowserPreview(this.getPreviewUri());
        await browserPreview.preview();
    }

    private getPreviewUri(): string {
        const uri = vscode.Uri.joinPath(this.serverUri, this.getFileName());
        console.info(`Previewing %s`, uri);
        return uri.toString();
    }

    // get real file name. e.g. /path/to/pet.yaml => pet.yaml
    private getFileName(): string {
        const editor = vscode.window.activeTextEditor;
        assert(editor);
        const document = editor.document;
        return path.basename(document.fileName);
    }
}
