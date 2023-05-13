import * as vscode from 'vscode';
import { VClient } from './client/vClient';
import { VParser } from './parser/vParser';
import { VServer } from './server/vServer';
import { getActivatedFileName } from './utils/fileUtil';

export async function activate(context: vscode.ExtensionContext) {
    try {
        console.info('v-swagger is activated');
        const vSever = VServer.getInstance();
        await vSever.start();

        const disposable = vscode.commands.registerCommand('v-swagger.preview', async () => {
            try {
                const rewriteConfig = vscode.workspace.getConfiguration('v-swagger').pathRewrite ?? {};
                const vParser = new VParser(rewriteConfig);

                const fileName = getActivatedFileName(vscode.window.activeTextEditor);
                const uri = await vParser.parse(fileName);

                const vClient = new VClient(uri);
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

export function deactivate() {
    const vSever = VServer.getInstance();
    vSever.stop();
    console.info('v-swagger is deactivated');
}
