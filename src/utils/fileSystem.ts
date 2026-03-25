import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * 初始化当前工作区的 .ykide 文件夹及忽略配置文件
 */
export async function initIdeFolder(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('未打开任何工作区，无法创建 .ykide 文件夹');
        return;
    }

    const rootPath = workspaceFolders[0].uri.fsPath;
    const ykideDir = path.join(rootPath, '.ykide');
    const yktreeFile = path.join(ykideDir, '.yktree');

    if (!fs.existsSync(ykideDir)) {
        fs.mkdirSync(ykideDir, { recursive: true });
        vscode.window.showInformationMessage('已成功创建 .ykide 文件夹！');
    }

    if (!fs.existsSync(yktreeFile)) {
        const defaultIgnores = [
            '# YK Snidea 忽略文件树配置',
            '# 规则与 .gitignore 完全一致',
            '.git',
            '.vscode',
            '.ykide',
            '.ide',
            'node_modules',
            'dist',
            'out'
        ].join('\n');
        fs.writeFileSync(yktreeFile, defaultIgnores, 'utf-8');
    }
}