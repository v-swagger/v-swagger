// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { VClient } from './preview/vClient';
import { VServer } from './preview/vServer';
import { getActivatedFileName } from './util/FileUtil';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
    try {
        console.info('v-swagger is activated');
        const vSever = VServer.getInstance();
        await vSever.start();
        const counterSwaggerUri = await vSever.serve(getActivatedFileName());
        const disposable = vscode.commands.registerCommand('v-swagger.preview', async () => {
            try {
                const vClient = new VClient(counterSwaggerUri);
                await vClient.preview();
            } catch (e) {
                console.error(`get an error during preview: %s`, e);
            }
        });

        context.subscriptions.push(disposable);
    } catch (e) {
        console.info(`get an error during v-swagger extension activation: %s`, e);
    }
}

// This method is called when your extension is deactivated
export function deactivate() {
    const vSever = VServer.getInstance();
    vSever.stop();
    console.info('v-swagger is deactivated');
}
