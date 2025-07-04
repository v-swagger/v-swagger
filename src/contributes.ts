import * as path from 'path';
import * as vscode from 'vscode';
import { VClient } from './client/vClient';
import { VParser } from './parser/vParser';
import { IOperationErrorContext } from './types';
import { ErrorHandler, VError } from './utils/errorHandler';
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
                const error = e as Error;

                // If the error is already a VError, use it directly
                const errorContext: IOperationErrorContext = {
                    fileName,
                    basename: baseFileName,
                    operation: 'preview',
                };
                const vError = error instanceof VError ? error : ErrorHandler.processError(error, errorContext);

                console.error(`Error during preview of ${baseFileName}:\n${vError.format()}`);

                // Show a more helpful error notification
                vscode.window.showErrorMessage(`Cannot preview ${baseFileName}`, {
                    detail: vError.format(),
                    modal: true,
                });

                // if preview gets an error, destroy the vParser and clear all listeners
                vParser.destroy(fileName);
            }
        }
    );
}
