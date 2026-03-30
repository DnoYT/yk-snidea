import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { LoggerService } from './LoggerService';
import { DiffService } from '../utils/DiffService';

/**
 * XML 标签解析服务 (用于处理 <file_change> 块)
 * 修复版：支持多属性标签及更灵活的匹配
 */
export class XmlService {
    private _normalizeWhitespace(str: string): string {
        if (!str) { return ''; }
        // 统一换行符并移除特殊不可见字符
        return str.replace(/\r\n/g, '\n').replace(/[\u00A0\u200B\u200C\u200D\uFEFF]/g, ' ');
    }

    private _unescapeArtifacts(str: string): string {
        if (!str) { return ''; }
        // 修复 AI 在 XML/Markdown 混合模式下习惯性将引号转义为 \" 的问题
        return str.replace(/\\"/g, '"');
    }

    /**
       * 移除字符串首尾的空白行及可能残留的标记字符，保留正常的代码缩进
       * 解决极简正则带来的边缘脏数据问题
       */
    private _trimEmptyLines(str: string): string {
        if (!str) { return ''; }
        // 1. 去除两端的空白行
        let cleaned = str.replace(/^\s*[\r\n]+/, '').replace(/[\r\n]+\s*$/, '');
        // 2. 预防性清理：如果匹配到了 ======= 或 >>>>>>> 这种脏尾巴，削掉它们
        cleaned = cleaned.replace(/^[ \t]*=======[^\n]*\n/g, '');
        cleaned = cleaned.replace(/\n[ \t]*>>>>>>>[^\n]*$/g, '');
        return cleaned;
    }

    public async applyXmlFromClipboard() {
        const rawText = await vscode.env.clipboard.readText();
        if (!rawText) {
            vscode.window.showWarningMessage('剪贴板为空');
            return;
        }

        LoggerService.log('--- 开始解析剪贴板 XML 内容 ---');

        // 打印原始剪贴板长度，确认读取无误
        LoggerService.log(`[DEBUG] 剪贴板原始文本长度: ${rawText.length}`);

        const text = this._normalizeWhitespace(rawText);

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('未找到打开的工作区');
            return;
        }
        const rootPath = workspaceFolders[0].uri.fsPath;

        // 第一阶段：提取独立的文件块 (剥离聊天上下文和 Markdown)
        // 匹配 <file_change ...> 到 </file_change> 之间的所有内容
        const containerRegex = /<file_change\s+([^>]+?)>([\s\S]*?)<\/file_change>/g;

        let containerMatch;
        let matchCount = 0;
        let successCount = 0;

        while ((containerMatch = containerRegex.exec(text)) !== null) {
            matchCount++;
            const attrString = containerMatch[1];
            const innerContent = containerMatch[2]; // 标签内部纯净的内容

            const relPath = this._parseAttribute(attrString, 'path');
            const action = this._parseAttribute(attrString, 'action') || 'replace';

            LoggerService.log(`[DEBUG] 发现第 ${matchCount} 个 <file_change> 块，路径: ${relPath}, 动作: ${action}`);

            if (!relPath) {
                LoggerService.log(`跳过无效的块：未找到 path 属性`, 'WARN');
                continue;
            }

            // 第二阶段：在纯净块中精细提取 SEARCH 和 REPLACE 块
            // 因为现在只处理一段单独的代码，不会受到外部文本干扰
            const searchRegex = /<<<<<<<\s*SEARCH([\s\S]*?)=======/i;
            const replaceRegex = /=======([\s\S]*?)>>>>>>>\s*REPLACE/i;

            const searchMatch = searchRegex.exec(innerContent);
            const replaceMatch = replaceRegex.exec(innerContent);

            if (!searchMatch || !replaceMatch) {
                LoggerService.log(`[DEBUG] 块内提取失败。找到 SEARCH: ${!!searchMatch}, 找到 REPLACE: ${!!replaceMatch}`, 'WARN');
                continue;
            }

            // 第三阶段：解码和清洗内容
            const searchContent = this._unescapeArtifacts(searchMatch[1]);
            const replaceContent = this._unescapeArtifacts(replaceMatch[1]);
                const absPath = path.join(rootPath, relPath);

                LoggerService.log(`正在处理 [${action}]: ${relPath}`);

                // 升级为 await，确保 Diff 窗口按顺序弹出
                const result = await this._processFileAction(absPath, searchContent, replaceContent, action);

                if (result) {
                    successCount++;
                    LoggerService.log(`[成功] 已应用修改: ${relPath}`);
                    continue;
                }

                LoggerService.log(`[失败] 未能在文件中匹配到 SEARCH 块: ${relPath}`, 'WARN');
                vscode.window.showWarningMessage(`未能匹配到 SEARCH 块: ${relPath}`);
            }

        if (matchCount === 0) {
            LoggerService.log('未发现有效的 <file_change> 格式块，请检查剪贴板内容', 'WARN');
            vscode.window.showErrorMessage('未发现可识别的代码修改块');
            return;
        }

        LoggerService.log(`--- XML 解析结束：成功 ${successCount}/${matchCount} ---`);
        vscode.window.showInformationMessage(`XML 应用完成: 成功 ${successCount}/${matchCount}`);
    }

    /**
         * 从属性字符串中提取指定属性的值
         */
    private _parseAttribute(attrString: string, attrName: string): string {
        const regex = new RegExp(`${attrName}=(?:\\\\)?["']([^"']+?)(?:\\\\)?["']`);
        const match = attrString.match(regex);
        return match ? match[1].trim() : '';
    }

    /**
     * 根据 action 类型分发文件处理逻辑
     */
    private async _processFileAction(absPath: string, search: string, replace: string, action: string): Promise<boolean> {
        if (action === 'create') {
            return this._handleCreateAction(absPath, replace);
        }

        return this._handleReplaceAction(absPath, search, replace, action);
    }

    /**
     * 处理创建文件逻辑 (action="create")
     */
    private _handleCreateAction(absPath: string, content: string): boolean {
        const dir = path.dirname(absPath);

        // 确保目录存在
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        const normalizedContent = this._normalizeWhitespace(content);
        fs.writeFileSync(absPath, normalizedContent, 'utf-8');
        return true;
    }

    /**
     * 处理替换内容逻辑 (action="replace")
     * 集成了 Diff 预览确认机制
     */
    private async _handleReplaceAction(absPath: string, search: string, replace: string, action: string): Promise<boolean> {
        if (!fs.existsSync(absPath)) {
            LoggerService.log(`[替换失败] 文件不存在: ${absPath}`, 'ERROR');
            return false;
        }

        const original = fs.readFileSync(absPath, 'utf-8');
        const isCrLf = original.includes('\r\n');

        const content = this._normalizeWhitespace(original);

        // 使用 _trimEmptyLines 剔除首尾空行，并确保搜索块非空
        const normalizedSearch = this._trimEmptyLines(this._normalizeWhitespace(search));
        const normalizedReplace = this._trimEmptyLines(this._normalizeWhitespace(replace));

        // 容错：如果搜索块为空（除了首尾空行外没有内容），则视为匹配失败，防止误删全文件
        if (!normalizedSearch && action === 'replace') {
            LoggerService.log(`[匹配失败] SEARCH 内容不能为空块: ${absPath}`, 'WARN');
            return false;
        }

        if (!content.includes(normalizedSearch)) {
            LoggerService.log(`[匹配失败] SEARCH 内容不匹配: ${absPath}`, 'DEBUG');
            return false;
        }

        const newContent = content.replace(normalizedSearch, () => normalizedReplace);
        const finalContent = isCrLf ? newContent.replace(/\n/g, '\r\n') : newContent;

        // 调用 Diff 工具展示预览窗口并等待确认
        const isConfirmed = await DiffService.showPreviewAndConfirm(absPath, finalContent);

        // 遵循 Early Return：如果用户未确认，直接返回失败（不应用修改）
        if (!isConfirmed) {
            LoggerService.log(`[用户取消] 放弃应用修改到: ${absPath}`);
            return false;
        }

        fs.writeFileSync(absPath, finalContent, 'utf-8');
        return true;
    }
}