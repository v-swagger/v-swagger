import * as vscode from 'vscode';
import { Previewer } from '../types';

export class BrowserPreviewer implements Previewer {
    constructor(private uri: vscode.Uri) {}

    public async preview() {
        try {
            await vscode.commands.executeCommand('vscode.open', this.uri);
        } catch (e) {
            console.error(`get an error when opening Browser`);
            throw e;
        }
    }
}
