import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { LoggerService } from './LoggerService';

/**
 * XML 标签解析服务 (用于处理 <file_change> 块)
 */
export class XmlService {
    private _normalizeWhitespace(str: string): string {
        if (!str) return '';
        return str.replace(/\r\n/g, '\n').replace(/[\u00A0\u200B\u200C\u200D\uFEFF]/g, ' ');
    }

    public async applyXmlFromClipboard() {
        const rawText = await vscode.env.clipboard.readText();
        if (!rawText) {
            vscode.window.showWarningMessage('剪贴板为空');
            return;
        }

        const text = this._normalizeWhitespace(rawText);
        const blockRegex = /<file_change\s+path="([^"]+)">\s*<<<<<<<\s*SEARCH\n([\s\S]*?)=======\n([\s\S]*?)>>>>>>>\s*REPLACE\s*<\/file_change>/g;

        let match;
        let matchCount = 0;
        let successCount = 0;

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) return;
        const rootPath = workspaceFolders[0].uri.fsPath;

        LoggerService.log('--- 开始解析 XML 修改 ---');

        while ((match = blockRegex.exec(text)) !== null) {
            matchCount++;
            const relPath = match[1].trim();
            const searchContent = match[2];
            const replaceContent = match[3];
            const absPath = path.join(rootPath, relPath);

            const result = this._applySingleChange(absPath, searchContent, replaceContent);
            if (result) {
                successCount++;
                LoggerService.log(`[成功] 已应用修改: ${relPath}`);
            } else {
                LoggerService.log(`[失败] 未匹配到 SEARCH 块: ${relPath}`, 'WARN');
                vscode.window.showWarningMessage(`未能匹配到 SEARCH 块: ${relPath}`);
            }
        }

        LoggerService.log(`--- XML 解析结束：成功 ${successCount}/${matchCount} ---`);
        vscode.window.showInformationMessage(`XML 应用完成: 成功 ${successCount}/${matchCount}`);
    }

    private _applySingleChange(absPath: string, search: string, replace: string): boolean {
        if (!fs.existsSync(absPath)) return false;

        const original = fs.readFileSync(absPath, 'utf-8');
        const isCrLf = original.includes('\r\n');
        let content = this._normalizeWhitespace(original);

        if (!content.includes(search)) return false;

        content = content.replace(search, () => replace);
        const finalContent = isCrLf ? content.replace(/\n/g, '\r\n') : content;
        fs.writeFileSync(absPath, finalContent, 'utf-8');
        return true;
    }
}