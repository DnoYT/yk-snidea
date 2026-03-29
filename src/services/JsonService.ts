import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { LoggerService } from './LoggerService';

/**
 * JSON 结构化解析与替换服务
 */
export class JsonService {
    private _normalizeWhitespace(str: string): string {
        if (!str) {
            return '';
        }
        return str
            .replace(/\r\n/g, '\n')
            .replace(/[\u00A0\u200B\u200C\u200D\uFEFF]/g, ' ')
            .replace(/ /g, ' ');
    }

    public async applyJsonFromClipboard() {
        const rawText = await vscode.env.clipboard.readText();
        if (!rawText) {
            vscode.window.showWarningMessage('剪贴板为空');
            return;
        }

        const jsonMatch = rawText.match(/```json\n([\s\S]*?)\n```/);
        const jsonStr = jsonMatch ? jsonMatch[1] : rawText;

        let data;
        try {
            data = JSON.parse(jsonStr);
        } catch (error) {
            vscode.window.showErrorMessage('剪贴板中未解析到有效的 JSON 格式');
            return;
        }

        if (!data.changes || !Array.isArray(data.changes)) {
            vscode.window.showWarningMessage('JSON 格式不符合要求，缺少 changes 数组');
            return;
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('未打开工作区，无法应用文件');
            return;
        }
        const rootPath = workspaceFolders[0].uri.fsPath;

        let successCount = 0;
        const matchCount = data.changes.length;

        LoggerService.log(`--- 开始处理 JSON 修改 (共 ${data.changes.length} 项) ---`);
        for (const change of data.changes) {
            if (!change.file || !change.action) {
                LoggerService.log('跳过无效的 change 项', 'WARN');
                continue;
            }

            const absPath = path.join(rootPath, change.file);
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
            const replaceNormalized = this._normalizeWhitespace(change.replace || '');

            if (change.action === 'create') {
                const finalContent = isCrLf ? replaceNormalized.replace(/\n/g, '\r\n') : replaceNormalized;
                fs.writeFileSync(absPath, finalContent, 'utf-8');
                successCount++;
                continue;
            }

            if (change.action === 'replace') {
                const searchNormalized = this._normalizeWhitespace(change.search || '');
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
                    vscode.window.showWarningMessage(`未能匹配到搜索块 (文件: ${change.file})`);
                }
            }
        }

        if (matchCount === 0) {
            vscode.window.showWarningMessage('JSON 中没有有效的修改项');
        }
        if (matchCount !== 0) {
            vscode.window.showInformationMessage(`JSON 应用完成: 成功修改 ${successCount} 个区块，共发现 ${matchCount} 个`);
        }
    }
}
