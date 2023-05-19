import * as vscode from 'vscode';
import { onPreview } from './contributes';
import { VServer } from './server/vServer';

export async function activate(context: vscode.ExtensionContext) {
    try {
        console.info('v-swagger is activated');
        await vscode.window.withProgress(
            {
                title: `Preview Server is starting ...`,
                location: vscode.ProgressLocation.Notification,
            },
            async () => {
                const vSever = VServer.getInstance();
                await vSever.start();
            }
        );

        const disposable = vscode.commands.registerCommand('v-swagger.preview', onPreview);

        context.subscriptions.push(disposable);
    } catch (e) {
        console.info(`get an error during v-swagger extension activation: %s`, e);
    }
}

export function deactivate() {
    const vSever = VServer.getInstance();
    vSever.stop();
    console.info('v-swagger is deactivated');
}
