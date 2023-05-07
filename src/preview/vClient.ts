import * as path from 'path';
import * as vscode from 'vscode';

import assert from 'assert';
import { BrowserPreviewer } from './browserPreviewer';
import { hashFileName } from './utils';
import { VSwaggerParser } from './vSwaggerParser';

export class VClient {
    private vSwaggerParser: VSwaggerParser;
    constructor(readonly serverUri: vscode.Uri) {
        this.vSwaggerParser = VSwaggerParser.getInstance();
    }

    public async preview() {
        const browserPreview = new BrowserPreviewer(this.getPreviewUri());
        await this.vSwaggerParser.parse(this.getActivatedFileName());
        await browserPreview.preview();
    }

    private getPreviewUri(): string {
        const uri = vscode.Uri.joinPath(this.serverUri, this.getFileNameHash(), this.getFileBasename());
        console.info(`Previewing %s`, uri);
        return uri.toString();
    }

    /**
     * get full file name. e.g. /path/to/pet.yaml
     */
    private getActivatedFileName() {
        const editor = vscode.window.activeTextEditor;
        assert(editor);
        return editor.document.fileName;
    }

    /**
     * get base file name. e.g. /path/to/pet.yaml => pet.yaml
     */
    private getFileBasename(): string {
        return path.basename(this.getActivatedFileName());
    }

    /**
     * get the first 8 characters of file name md5 hash code
     */
    private getFileNameHash(): string {
        return hashFileName(this.getActivatedFileName());
    }
}
