import * as path from 'path';
import * as vscode from 'vscode';
import { VClient } from './client/vClient';
import { VParser } from './parser/vParser';
import { getActivatedFileName } from './utils/fileUtil';

/**
 * The handler of 'Preview Swagger'
 */
export async function onPreview() {
    const fileName = getActivatedFileName(vscode.window.activeTextEditor);
    const baseFileName = path.basename(fileName);
    await vscode.window.withProgress(
        {
            title: `Previewing ${baseFileName} ...`,
            location: vscode.ProgressLocation.Notification,
        },
        async () => {
            try {
                const rewriteConfig = vscode.workspace.getConfiguration('v-swagger').pathRewrite ?? {};
                const vParser = new VParser(rewriteConfig, fileName);
                const uri = await vParser.parse();

                const vClient = new VClient(uri);
                await vClient.preview();
            } catch (e) {
                console.error(`get an error during preview: %s`, e);
            }
        }
    );
}
