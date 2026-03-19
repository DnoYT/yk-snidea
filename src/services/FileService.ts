import * as vscode from 'vscode';
import * as path from 'path';

/**
 * 文件处理服务：负责工作区文件的搜索、读取与打开
 */
export class FileService {
    /**
     * 在工作区搜索文件
     * @param keyword 搜索关键词
     * @returns 格式化后的文件列表
     */
    public async searchWorkspaceFiles(keyword: string) {
        const workspaceFolders = vscode.workspace.workspaceFolders;

        // 提前返回：如果没有打开工作区
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return [];
        }

        try {
            const searchPattern = keyword ? `**/*${keyword}*` : `**/*`;
            // 排除干扰目录
            const excludePattern = '**/{node_modules,.git,dist,out,.vscode,obj,bin}/**';

            // 限制 20 条提高响应速度
            const uris = await vscode.workspace.findFiles(searchPattern, excludePattern, 20);

            return uris.map(uri => ({
                fsPath: uri.fsPath,
                relativePath: vscode.workspace.asRelativePath(uri, false),
                fileName: path.basename(uri.fsPath)
            }));
        } catch (error) {
            console.error('[FileService] 搜索失败:', error);
            return [];
        }
    }

    /**
     * 读取指定路径的文件内容
     * @param filePath 绝对路径
     */
    public async getFileContent(filePath: string): Promise<string> {
        if (!filePath) return '';

        try {
            const uri = vscode.Uri.file(filePath);
            const document = await vscode.workspace.openTextDocument(uri);
            return document.getText();
        } catch (error) {
            console.error(`[FileService] 读取文件失败: ${filePath}`, error);
            return `[读取失败]: 无法访问文件 ${path.basename(filePath)}`;
        }
    }

    /**
     * 在编辑器中打开文件
     */
    public async openFile(filePath: string) {
        if (!filePath) return;

        try {
            const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
            await vscode.window.showTextDocument(document, { preview: false });
        } catch (error) {
            vscode.window.showErrorMessage(`无法打开文件: ${filePath}`);
        }
    }
}