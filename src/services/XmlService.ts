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
      * 移除字符串首尾的空白行，保留正常的代码缩进
      */
    private _trimEmptyLines(str: string): string {
        if (!str) { return ''; }
        return str.replace(/^\s*[\r\n]+/, '').replace(/[\r\n]+\s*$/, '');
    }

    public async applyXmlFromClipboard() {
        const rawText = await vscode.env.clipboard.readText();
        if (!rawText) {
            vscode.window.showWarningMessage('剪贴板为空');
            return;
        }
        // 版本号用于测试过程中判断错乱版本
        let v = "207";
        LoggerService.log('---【' + v + '】 开始解析剪贴板 XML 内容 ---');

        // 打印原始剪贴板长度，确认读取无误
        LoggerService.log(`[DEBUG] 剪贴板原始文本长度: ${rawText.length}`);
        LoggerService.log(`[DEBUG] 剪贴板原始文本: ${rawText}`);

        const text = this._normalizeWhitespace(rawText);

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('未找到打开的工作区');
            return;
        }
        const rootPath = workspaceFolders[0].uri.fsPath;

        // 彻底抛弃全局正则提取，改用真正工业级的“逐行状态机 (State Machine)”解析架构
        // 这种模式能完美免疫代码内容中出现的任何类似标签的文本引发的“自吞噬”BUG。
        const lines = text.split('\n');

        interface ChangeBlock {
            path: string;
            action: string;
            search: string[];
            replace: string[];
        }

        const blocks: ChangeBlock[] = [];
        let currentBlock: ChangeBlock | null = null;
        let state: 'IDLE' | 'IN_SEARCH' | 'IN_REPLACE' = 'IDLE';

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            if (state === 'IDLE') {
                // 仅匹配行首开头的标签，避免匹配到代码或注释中的冗余字符
                const fileMatch = /^\s*<file_change\s+([^>]+?)>/i.exec(line);
                if (fileMatch) {
                    const attrString = fileMatch[1];
                    currentBlock = {
                        path: this._parseAttribute(attrString, 'path'),
                        action: this._parseAttribute(attrString, 'action') || 'replace',
                        search: [],
                        replace: []
                    };
                    continue;
                }

                if (currentBlock && /^\s*<<<<<<<\s*SEARCH/i.test(line)) {
                    state = 'IN_SEARCH';
                    continue;
                }
                continue;
            }

            if (state === 'IN_SEARCH') {
                if (/^\s*=======\s*$/i.test(line)) {
                    state = 'IN_REPLACE';
                    continue;
                }
                currentBlock!.search.push(line);
                continue;
            }

            if (state === 'IN_REPLACE') {
                if (/^\s*>>>>>>>\s*REPLACE/i.test(line)) {
                    // 核心边界：当前块收集完毕，推入队列
                    blocks.push(currentBlock!);
                    currentBlock = null;
                    state = 'IDLE';
                    continue;
                }
                currentBlock!.replace.push(line);
                continue;
            }
        }

        if (blocks.length === 0) {
            LoggerService.log('未发现有效的 <file_change> 格式块，请检查剪贴板内容', 'WARN');
            vscode.window.showErrorMessage('未发现可识别的代码修改块');
            return;
        }

        let successCount = 0;

        for (const block of blocks) {
            if (!block.path) {
                LoggerService.log(`跳过无效的块：未找到 path 属性`, 'WARN');
                continue;
            }

            // 因为状态机天然剥离了定界符，不再需要专门剔除 ======= 等脏数据
            const searchContent = this._unescapeArtifacts(block.search.join('\n'));
            const replaceContent = this._unescapeArtifacts(block.replace.join('\n'));
            const absPath = path.join(rootPath, block.path);

            LoggerService.log(`正在处理 [${block.action}]: ${block.path}`);

            const result = await this._processFileAction(absPath, searchContent, replaceContent, block.action);

            if (result) {
                successCount++;
                LoggerService.log(`[成功] 已应用修改: ${block.path}`);
                continue;
            }

            LoggerService.log(`[失败] 未能在文件中匹配到 SEARCH 块: ${block.path}`, 'WARN');
            vscode.window.showWarningMessage(`未能匹配到 SEARCH 块: ${block.path}`);
        }

        LoggerService.log(`--- XML 解析结束：成功 ${successCount}/${blocks.length} ---`);
        vscode.window.showInformationMessage(`XML 应用完成: 成功 ${successCount}/${blocks.length}`);
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
     * 滑动窗口语义对齐算法 (Sliding Window Token Alignment)
     * 抛弃脆弱的锚点机制，直接提取核心语义（字母、数字、中文）计算区块相似度
     */
    private _fuzzyMatchAndReplace(content: string, search: string, replace: string, absPath: string): string | null {
        const searchLines = search.split('\n');
        const fileLines = content.split('\n');
        
        // 核心：归一化提取纯语义文本（剔除所有的空格、符号、换行，仅保留核心字符）
        const normalize = (s: string) => s.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '').toLowerCase();

        const searchNorms = searchLines
            .map(line => ({ norm: normalize(line) }))
            .filter(item => item.norm.length > 0);

        if (searchNorms.length === 0) {
            LoggerService.log(`[模糊匹配跳过] SEARCH 块无有效语义文本: ${absPath}`, 'DEBUG');
            return null;
        }

        let bestScore = 0;
        let bestStart = -1;
        let bestEnd = -1;

        // 1. 滑动窗口遍历全文件
        for (let i = 0; i < fileLines.length; i++) {
            let currentScore = 0;
            let searchIdx = 0;
            let j = i;
            
            // 窗口最大延伸范围：允许 AI 漏掉或多写一些无用行
            const maxWindow = searchLines.length * 1.5 + 10;

            while (j < fileLines.length && (j - i) < maxWindow && searchIdx < searchNorms.length) {
                const fileNorm = normalize(fileLines[j]);
                if (fileNorm.length === 0) {
                    j++;
                    continue; // 跳过空行
                }
                
                const searchNorm = searchNorms[searchIdx].norm;
                // 若语义文本完全匹配或存在包含关系，则加上该文本权重的分数
                if (fileNorm === searchNorm || fileNorm.includes(searchNorm) || searchNorm.includes(fileNorm)) {
                    currentScore += searchNorm.length;
                    searchIdx++;
                }
                j++;
            }

            // 记录最高分及对应的文件物理行边界
            if (currentScore > bestScore) {
                bestScore = currentScore;
                bestStart = i;
                bestEnd = j - 1;
            }
        }

        // 2. 计算匹配率 (基于核心字符长度而非行数)
        const totalSearchChars = searchNorms.reduce((acc, val) => acc + val.norm.length, 0);
        const matchRatio = bestScore / totalSearchChars;

        // 3. 执行应用：只要 60% 核心文本吻合，就视为 AI 幻觉并强制修复
        if (matchRatio >= 0.6) {
            LoggerService.log(`[滑动窗口修复成功] 相似度: ${(matchRatio * 100).toFixed(1)}%, 定位: ${absPath} (行 ${bestStart + 1}-${bestEnd + 1})`, 'INFO');

            // 使用数组切割来精确替换区块，防止 replace() 误伤文件中其他相同内容的文本
            const before = fileLines.slice(0, bestStart);
            const after = fileLines.slice(bestEnd + 1);
            return [...before, replace, ...after].join('\n');
        }

        LoggerService.log(`[滑动窗口修复失败] 最佳相似度仅为 ${(matchRatio * 100).toFixed(1)}% (阈值 60%): ${absPath}`, 'WARN');
        return null;
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
     */
    private async _handleReplaceAction(absPath: string, search: string, replace: string, action: string): Promise<boolean> {
        if (!fs.existsSync(absPath)) {
            LoggerService.log(`[文件不存在] 自动切换为创建文件模式: ${absPath}`, 'INFO');
            return this._handleCreateAction(absPath, replace);
        }

        const original = fs.readFileSync(absPath, 'utf-8');
        const isCrLf = original.includes('\r\n');
        const content = this._normalizeWhitespace(original);

        const normalizedSearch = this._trimEmptyLines(this._normalizeWhitespace(search));
        const normalizedReplace = this._trimEmptyLines(this._normalizeWhitespace(replace));

        if (!normalizedSearch && action === 'replace') {
            LoggerService.log(`[匹配失败] SEARCH 内容不能为空块: ${absPath}`, 'WARN');
            return false;
        }

        /**
         * 替换前置检查 (Pre-check) - 防止重复替换与无用操作
         */
        if (normalizedSearch === normalizedReplace) {
            LoggerService.log(`[跳过] SEARCH 和 REPLACE 内容完全一致，无需修改: ${absPath}`, 'INFO');
            return true;
        }

        if (normalizedReplace && content.includes(normalizedReplace) && !content.includes(normalizedSearch)) {
            LoggerService.log(`[跳过] 文件似乎已包含 REPLACE 目标内容，可能已被处理过: ${absPath}`, 'INFO');
            return true; // 当作成功处理，避免对外抛出错误
        }

        // 策略 1：尝试严格匹配 (High Performance)
        if (content.includes(normalizedSearch)) {
            const newContent = content.replace(normalizedSearch, () => normalizedReplace);
            return this._performFileWrite(absPath, newContent, isCrLf);
        }

        // 策略 2：智能模糊修复 (Resilience Mode)
        const fuzzyResult = this._fuzzyMatchAndReplace(content, normalizedSearch, normalizedReplace, absPath);
        if (fuzzyResult) {
            return this._performFileWrite(absPath, fuzzyResult, isCrLf);
        }

        LoggerService.log(`[最终匹配失败] 请检查文件内容是否已手动更改或 SEARCH 块过于陈旧: ${absPath}`, 'WARN');
        return false;
    }

    /**
     * 执行物理文件写入并处理换行符归一化
     */
    private _performFileWrite(absPath: string, content: string, isCrLf: boolean): boolean {
        const finalContent = isCrLf ? content.replace(/\n/g, '\r\n') : content;
        fs.writeFileSync(absPath, finalContent, 'utf-8');
        return true;
    }
}