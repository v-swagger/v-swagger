// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { VClient } from './preview/vClient';
import { VServer } from './preview/vServer';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    console.info('v-swagger is activated');

    const disposable = vscode.commands.registerCommand('v-swagger.preview', async () => {
        try {
            const vSever = new VServer();
            await vSever.start();

            const vClient = new VClient(vSever.getServerUri());
            await vClient.preview();
        } catch (e) {
            console.error(`get an error during preview: %s`, e);
        }
    });

    context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
