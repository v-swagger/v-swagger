import * as path from 'path';
import * as vscode from 'vscode';
import { VClient } from './client/vClient';
import { VParser } from './parser/vParser';
import { getActivatedFileName } from './utils/utils';

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
            const vParser = VParser.getInstance(fileName);
            try {
                const uri = await vParser.parse();

                const vClient = new VClient(uri);
                await vClient.preview();
            } catch (e: unknown) {
                console.error(`get an error during preview: %s`, e);
                vscode.window.showErrorMessage(`Cannot preview ${baseFileName} due to an error`, {
                    detail: (e as Error)?.message,
                    modal: true,
                });
                // if preview gets an error, destroy the vParser and clear all listeners
                vParser.destroy(fileName);
            }
        }
    );
}
