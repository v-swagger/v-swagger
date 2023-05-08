import * as vscode from 'vscode';
import { PreviewerFactory } from '../previewer/previewerFactory';

export class VClient {
    constructor(readonly uri: vscode.Uri) {}

    public async preview() {
        const previewer = PreviewerFactory.create(this.uri);
        await previewer.preview();
    }
}
