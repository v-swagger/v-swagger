import * as vscode from 'vscode';
import { IPreviewer } from '../../types';

export class BrowserPreviewer implements IPreviewer {
    constructor(private uri: vscode.Uri) {}

    public async preview() {
        try {
            await vscode.commands.executeCommand('vscode.open', this.uri);
        } catch (e) {
            console.error(`[browser-previewer]: get an error when opening Browser`);
            throw e;
        }
    }
}
