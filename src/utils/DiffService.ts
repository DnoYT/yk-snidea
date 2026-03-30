import * as vscode from 'vscode';
import * as path from 'path';

/**
 * 差异对比工具类
 */
export class DiffService {
    /**
     * 打开 VSCode 原生 Diff 窗口并等待用户确认
     * @param absPath 原始物理文件路径
     * @param newContent 准备写入的新内容
     */
    public static async showPreviewAndConfirm(absPath: string, newContent: string): Promise<boolean> {
        const fileUri = vscode.Uri.file(absPath);
        const fileName = path.basename(absPath);
        
        // 使用 untitled 模式创建临时内存文档
        const tempUri = vscode.Uri.parse(`untitled:${absPath}.preview`);
        
        try {
            const doc = await vscode.workspace.openTextDocument(tempUri);
            const edit = new vscode.WorkspaceEdit();
            edit.insert(tempUri, new vscode.Position(0, 0), newContent);
            await vscode.workspace.applyEdit(edit);

            // 弹出 Diff 视图
            await vscode.commands.executeCommand('vscode.diff', fileUri, tempUri, `${fileName} (预览修改)`);

            const choice = await vscode.window.showInformationMessage(
                `确定应用对 ${fileName} 的修改吗？`,
                { modal: true },
                '应用修改',
                '放弃'
            );

            // 关闭当前活动的编辑器（预览窗口）
            await vscode.commands.executeCommand('workbench.action.closeActiveEditor');

            return choice === '应用修改';
        } catch (error) {
            vscode.window.showErrorMessage(`预览失败: ${error}`);
            return false;
        }
    }
}