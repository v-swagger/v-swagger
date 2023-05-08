import * as vscode from 'vscode';
import { Previewer } from '../types';

export class WebviewPanelPreviewer implements Previewer {
    constructor(private uri: vscode.Uri) {}

    public async preview() {
        try {
            const panel = vscode.window.createWebviewPanel(this.uri.toString(), `V-Swagger`, vscode.ViewColumn.Two, {
                enableScripts: true,
            });

            // Open the URL in the webview panel
            panel.webview.html = this.getWebviewContent();
        } catch (e) {
            console.error(`get an error when opening webview panel`);
            throw e;
        }
    }

    private getWebviewContent() {
        return `<!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>V-Swagger</title>
      </head>
      <body>
        <div style="position:fixed;height:100%;width:100%;">
            <iframe src="${this.uri.toString()}" frameborder="0" style="overflow:hidden;height:100%;width:100%" height="100%" width="100%"></iframe>
        </div>
      </body>
      </html>`;
    }
}
