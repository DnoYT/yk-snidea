import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Diff 解析与替换服务
 */
export class DiffService {
    private _normalizeWhitespace(str: string): string {
        if (!str) {
            return '';
        }
        return str
            .replace(/\r\n/g, '\n')
            .replace(/[\u00A0\u200B\u200C\u200D\uFEFF]/g, ' ')
            .replace(/ /g, ' ');
    }

    public async applyDiffFromClipboard() {
        const rawText = await vscode.env.clipboard.readText();
        if (!rawText) {
            vscode.window.showWarningMessage('剪贴板为空');
            return;
        }

        const text = this._normalizeWhitespace(rawText);
        const blockRegex = /File:([^\n\r]+)[\s\S]*?<<<<<<<\s*SEARCH\n([\s\S]*?)=======\n([\s\S]*?)>>>>>>>\s*REPLACE/g;
        
        let match;
        let matchCount = 0;
        let successCount = 0;

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('未打开工作区，无法应用文件');
            return;
        }
        const rootPath = workspaceFolders[0].uri.fsPath;

        while ((match = blockRegex.exec(text)) !== null) {
            matchCount++;
            const relPath = match[1].trim();
            const searchContent = match[2];
            const replaceContent = match[3];

            const absPath = path.join(rootPath, relPath);
            const dirPath = path.dirname(absPath);

            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
            }

            let originalContent = '';
            if (fs.existsSync(absPath)) {
                originalContent = fs.readFileSync(absPath, 'utf-8');
            }
            const isCrLf = originalContent.includes('\r\n');

            let fileNormalized = this._normalizeWhitespace(originalContent);
            const searchNormalized = searchContent;
            const replaceNormalized = replaceContent;

            let modified = false;

            if (fileNormalized.includes(searchNormalized)) {
                fileNormalized = fileNormalized.replace(searchNormalized, () => replaceNormalized);
                modified = true;
            }
            
            if (!modified) {
                const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const searchPattern = escapeRegex(searchNormalized.trim()).replace(/\s+/g, '\\s*');
                const searchRegex = new RegExp(searchPattern);

                if (searchRegex.test(fileNormalized)) {
                    fileNormalized = fileNormalized.replace(searchRegex, () => replaceNormalized.trim());
                    modified = true;
                }
            }

            if (modified) {
                const finalContent = isCrLf ? fileNormalized.replace(/\n/g, '\r\n') : fileNormalized;
                fs.writeFileSync(absPath, finalContent, 'utf-8');
                successCount++;
            }
            if (!modified) {
                vscode.window.showWarningMessage(`未能匹配到 SEARCH 块 (上下差异过大): ${relPath}`);
            }
        }

        if (matchCount === 0) {
            vscode.window.showWarningMessage('剪贴板中没有解析到有效的 Diff/Replace 块');
        }
        if (matchCount !== 0) {
            vscode.window.showInformationMessage(`Diff 应用完成: 成功修改 ${successCount} 个区块，共发现 ${matchCount} 个`);
        }
    }
}
