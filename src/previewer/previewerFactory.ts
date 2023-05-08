import * as vscode from 'vscode';
import { Previewer } from '../types';
import { BrowserPreviewer } from './browserPreviewer';
import { WebviewPanelPreviewer } from './webviewPanelPreviewer';

export class PreviewerFactory {
    static create(uri: vscode.Uri): Previewer {
        const previewInBrowser = vscode.workspace.getConfiguration('v-swagger').previewInBrowser;
        return previewInBrowser ? new BrowserPreviewer(uri) : new WebviewPanelPreviewer(uri);
    }
}
