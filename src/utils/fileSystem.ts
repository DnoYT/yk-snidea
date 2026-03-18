import * as vscode from 'vscode';

/**
 * 初始化当前工作区的 .ide 文件夹
 */
export async function initIdeFolder(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;

    // 提前返回，避免 else 嵌套
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('未打开任何工作区，无法创建 .ide 文件夹');
        return;
    }

    const rootUri = workspaceFolders[0].uri;
    const ideFolderUri = vscode.Uri.joinPath(rootUri, '.ide');

    try {
        // 尝试读取文件夹状态，如果报错说明不存在，直接跳到 catch 去创建
        await vscode.workspace.fs.stat(ideFolderUri);
        vscode.window.showInformationMessage('.ide 文件夹已存在');
    } catch (error) {
        // 文件夹不存在，执行创建
        await vscode.workspace.fs.createDirectory(ideFolderUri);
        vscode.window.showInformationMessage('已成功创建 .ide 文件夹！');
    }
}