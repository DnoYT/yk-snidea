import * as vscode from 'vscode';

/**
 * 生成 Webview 所需的 HTML 内容
 * @param webview Webview 实例
 * @param extensionUri 插件根路径
 */
export function getWebviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'index.js'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'index.css'));

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="stylesheet" href="${styleUri}">
        <title>YK Snidea</title>
    </head>
    <body>
        <div id="app"></div>
        <script src="${scriptUri}"></script>
    </body>
    </html>`;
}