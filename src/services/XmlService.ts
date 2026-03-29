import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { LoggerService } from './LoggerService';

/**
 * XML 标签解析服务 (用于处理 <file_change> 块)
 * 修复版：支持多属性标签及更灵活的匹配
 */
export class XmlService {
    private _normalizeWhitespace(str: string): string {
        if (!str) return '';
        // 统一换行符并移除特殊不可见字符
        return str.replace(/\r\n/g, '\n').replace(/[\u00A0\u200B\u200C\u200D\uFEFF]/g, ' ');
    }

    private _unescapeArtifacts(str: string): string {
        if (!str) return '';
        // 修复 AI 在 XML/Markdown 混合模式下习惯性将引号转义为 \" 的问题
        return str.replace(/\\"/g, '"');
    }

    public async applyXmlFromClipboard() {
        const rawText = await vscode.env.clipboard.readText();
        if (!rawText) {
            vscode.window.showWarningMessage('剪贴板为空');
            return;
        }

        LoggerService.log('--- 开始解析剪贴板 XML 内容 ---');

        const text = this._normalizeWhitespace(rawText);

        /**
         * 增强版正则表达式：
         * 1. <file_change[^>]*? : 允许标签内有其他属性（如 action="replace"）
         * 2. path=(?:\\)?["']([^"']+?) : 兼容转义引号和单双引号，提取路径
         * 3. [^>]*?> : 允许路径属性后还有其他属性
         * 4. [\s\S]*? : 非贪婪匹配 SEARCH 和 REPLACE 内容
         */
        const blockRegex = /<file_change[^>]*?\s+path=(?:\\)?["']([^"']+?)(?:\\)?["'][^>]*?>\s*<<<<<<<\s*SEARCH\n([\s\S]*?)=======\n([\s\S]*?)>>>>>>>\s*REPLACE\s*<\/file_change>/g;

        let match;
        let matchCount = 0;
        let successCount = 0;

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('未找到打开的工作区');
            return;
        }
        const rootPath = workspaceFolders[0].uri.fsPath;

        while ((match = blockRegex.exec(text)) !== null) {
            matchCount++;
            const relPath = match[1].trim();
            // 清理可能存在的转义字符
            const searchContent = this._unescapeArtifacts(match[2]);
            const replaceContent = this._unescapeArtifacts(match[3]);
            const absPath = path.join(rootPath, relPath);

            LoggerService.log(`正在尝试应用修改到: ${relPath}`);

            const result = this._applySingleChange(absPath, searchContent, replaceContent);
            if (result) {
                successCount++;
                LoggerService.log(`[成功] 已应用修改: ${relPath}`);
            } else {
                LoggerService.log(`[失败] 未能在文件中匹配到 SEARCH 块: ${relPath}`, 'WARN');
                vscode.window.showWarningMessage(`未能匹配到 SEARCH 块: ${relPath}`);
            }
        }

        if (matchCount === 0) {
            LoggerService.log('未发现有效的 <file_change> 格式块，请检查剪贴板内容', 'WARN');
            vscode.window.showErrorMessage('未发现可识别的代码修改块');
        } else {
            LoggerService.log(`--- XML 解析结束：成功 ${successCount}/${matchCount} ---`);
            vscode.window.showInformationMessage(`XML 应用完成: 成功 ${successCount}/${matchCount}`);
        }
    }

    private _applySingleChange(absPath: string, search: string, replace: string): boolean {
        if (!fs.existsSync(absPath)) {
            LoggerService.log(`文件路径不存在: ${absPath}`, 'ERROR');
            return false;
        }

        const original = fs.readFileSync(absPath, 'utf-8');
        const isCrLf = original.includes('\r\n');

        // 统一处理为 LF 进行匹配
        let content = this._normalizeWhitespace(original);
        const normalizedSearch = this._normalizeWhitespace(search);
        const normalizedReplace = this._normalizeWhitespace(replace);

        if (!content.includes(normalizedSearch)) {
            // 记录一下差异，方便调试
            LoggerService.log(`SEARCH 块匹配失败。文件长度: ${content.length}, 搜索长度: ${normalizedSearch.length}`, 'DEBUG');
            return false;
        }

        // 使用函数式替换避免 $ 符号被正则误解
        content = content.replace(normalizedSearch, () => normalizedReplace);

        // 还原原始换行符格式
        const finalContent = isCrLf ? content.replace(/\n/g, '\r\n') : content;
        fs.writeFileSync(absPath, finalContent, 'utf-8');
        return true;
    }
}