import * as vscode from 'vscode';
import { FileService } from '../services/FileService';
import { PromptService } from '../services/PromptService';
import { ConfigService } from '../services/ConfigService';
import { DatabaseService, DbConfig } from '../services/DatabaseService';
import * as path from 'path';
import * as fs from 'fs';

export class MessageRouter {
    constructor(
        private readonly _fileService: FileService,
        private readonly _promptService: PromptService,
        private readonly _configService: ConfigService,
        private readonly _dbService: DatabaseService,
        private readonly _context: vscode.ExtensionContext
    ) { }

    private _refreshSettings(webviewView: vscode.WebviewView) {
        webviewView.webview.postMessage({
            type: 'settingsData',
            roles: this._configService.getRoles(),
            rules: this._configService.getRules(),
            profiles: this._configService.getProfiles(),
            diffConfig: this._configService.getDiffConfig()
        });
    }

    private async _applyDiffFromClipboard() {
        const text = await vscode.env.clipboard.readText();
        if (!text) {
            vscode.window.showWarningMessage('剪贴板为空');
            return;
        }

        // 修复1：放宽正则限制，兼容 Windows (\r\n) 与前后可能残留的空格
        const blockRegex = /文件：([^\n\r]+)[\s\S]*?<<<<<<<\s*SEARCH\r?\n([\s\S]*?)=======\r?\n([\s\S]*?)>>>>>>>\s*REPLACE/g;
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
            if (!fs.existsSync(absPath)) {
                vscode.window.showWarningMessage(`文件未找到: ${relPath}`);
                continue;
            }

            const fileContent = fs.readFileSync(absPath, 'utf-8');
            const isCrLf = fileContent.includes('\r\n'); // 记录原始换行符类型

            let fileNormalized = fileContent.replace(/\r\n/g, '\n');
            const searchNormalized = searchContent.replace(/\r\n/g, '\n');
            const replaceNormalized = replaceContent.replace(/\r\n/g, '\n');

            let modified = false;

            // 方案 A：精准匹配 (优先尝试最高效的纯文本匹配)
            if (fileNormalized.includes(searchNormalized)) {
                // 修复3：使用函数返回 replace 内容，避免 PHP 代码中的 $ 符号被当成正则变量
                fileNormalized = fileNormalized.replace(searchNormalized, () => replaceNormalized);
                modified = true;
            } else {
                // 方案 B：模糊匹配 (解决大模型吞噬空行、不可见空格等情况)
                const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                // 将 Search 块内的所有空白字符段落统一转化为 \s+，无视换行与空格的差异
                const searchPattern = escapeRegex(searchNormalized.trim()).replace(/\s+/g, '\\s+');
                const searchRegex = new RegExp(searchPattern);

                if (searchRegex.test(fileNormalized)) {
                    fileNormalized = fileNormalized.replace(searchRegex, () => replaceNormalized.trim());
                    modified = true;
                }
            }

            if (modified) {
                // 修复2：如果原文件使用 CRLF，在保存前将其还原
                const finalContent = isCrLf ? fileNormalized.replace(/\n/g, '\r\n') : fileNormalized;
                fs.writeFileSync(absPath, finalContent, 'utf-8');
                successCount++;
            } else {
                vscode.window.showWarningMessage(`未能匹配到 SEARCH 块 (上下差异过大): ${relPath}`);
            }
        }

        if (matchCount === 0) {
            vscode.window.showWarningMessage('剪贴板中没有解析到有效的 Diff/Replace 块');
        } else {
            vscode.window.showInformationMessage(`Diff 应用完成: 成功修改 ${successCount} 个区块，共发现 ${matchCount} 个`);
        }
    }

    private async _handleDbSave(webviewView: vscode.WebviewView, config: DbConfig) {
        try {
            await this._dbService.saveConfig(config);
            const tables = await this._dbService.testAndGetTables(config);
            console.log('数据库连接成功！');
            webviewView.webview.postMessage({ type: 'dbStatus', success: true, tables });
        } catch (err: any) {
            console.log(`连接失败: ${err.message}`);
            webviewView.webview.postMessage({ type: 'dbStatus', success: false, error: err.message });
        }
    }

    private async _handleTableSearch(webviewView: vscode.WebviewView, keyword: string) {
        const config = this._dbService.getConfig();
        if (!config) {
            webviewView.webview.postMessage({ type: 'tableResults', tables: [] });
            return;
        }
        try {
            const allTables = await this._dbService.testAndGetTables(config);
            const filtered = allTables.filter(t => t.includes(keyword || ''));
            webviewView.webview.postMessage({ type: 'tableResults', tables: filtered });
        } catch (err) {
            webviewView.webview.postMessage({ type: 'tableResults', tables: [] });
        }
    }

    /**
     * 主消息分发中心
     */
    public async handleMessage(webviewView: vscode.WebviewView, message: any) {
        console.log("[MessageRouter] 收到请求:", message.type);

        if (message.type === 'exportSettings') {
            await this._configService.exportConfiguration();
            return;
        }

        if (message.type === 'importSettings') {
            const uris = await vscode.window.showOpenDialog({
                canSelectMany: false,
                filters: { 'JSON Files': ['json'] },
                openLabel: '导入配置'
            });

            if (uris && uris.length > 0) {
                try {
                    const content = fs.readFileSync(uris[0].fsPath, 'utf-8');
                    const parsed = JSON.parse(content);

                    if (parsed.roles && Array.isArray(parsed.roles)) {
                        for (const r of parsed.roles) { await this._configService.saveRole(r); }
                    }
                    if (parsed.rules && Array.isArray(parsed.rules)) {
                        for (const r of parsed.rules) { await this._configService.saveRule(r); }
                    }
                    if (parsed.profiles && Array.isArray(parsed.profiles)) {
                        for (const p of parsed.profiles) { await this._configService.saveProfile(p); }
                    }

                    vscode.window.showInformationMessage('配置导入成功！');
                    this._refreshSettings(webviewView);
                } catch (err: any) {
                    vscode.window.showErrorMessage('导入失败：' + err.message);
                }
            }
            return;
        }

        if (message.type === 'applyDiffFromClipboard') {
            await this._applyDiffFromClipboard();
            return;
        }

        // 获取保存的提示词配置
        if (message.type === 'getPromptConfig') {
            const config = this._configService.getPromptConfig();
            webviewView.webview.postMessage({
                type: 'promptConfigData',
                data: config
            });
            return;
        }

        // 保存当前的提示词配置
        if (message.type === 'savePromptConfig') {
            await this._configService.savePromptConfig(message.data);
            // 可以选加一个通知：vscode.window.showInformationMessage('配置已保存');
            return;
        }

        // 生成提示词逻辑 (确保也带上保存逻辑，或者分开)
        if (message.type === 'generate') {
            // 自动保存一次当前配置，方便下次打开回显
            await this._configService.savePromptConfig(message.data);

            const prompt = await this._promptService.build(message.data, this._context);
            webviewView.webview.postMessage({
                type: 'renderResult',
                value: prompt
            });
            return;
        }

        // 1. 处理复制（通过后端 API 绕过前端限制）
        if (message.type === 'copyToClipboard') {
            await vscode.env.clipboard.writeText(message.value);
            vscode.window.showInformationMessage('已复制到剪贴板');
            return;
        }

        // 2. 保存为 Markdown 文件
        if (message.type === 'savePromptFile') {
            try {
                const firstFile = message.files && message.files.length > 0 ? message.files[0] : 'prompt';
                const savedPath = await this._configService.savePromptAsMarkdown(message.value, firstFile);
                const fileName = path.basename(savedPath);
                vscode.window.showInformationMessage(`保存成功: .ykide/${fileName}`);
            } catch (err: any) {
                vscode.window.showErrorMessage(`保存失败: ${err.message}`);
            }
            return;
        }

        // --- 1. 基础消息 ---
        if (message.type === 'getSettings') {
            this._refreshSettings(webviewView);
            return;
        }

        // --- 2. 角色/规则/规范管理 ---
        if (message.type === 'saveRole') {
            await this._configService.saveRole(message.data);
            this._refreshSettings(webviewView);
            return;
        }
        if (message.type === 'deleteRole') {
            await this._configService.deleteRole(message.roleId);
            this._refreshSettings(webviewView);
            return;
        }
        if (message.type === 'saveRule') {
            await this._configService.saveRule(message.data);
            this._refreshSettings(webviewView);
            return;
        }
        if (message.type === 'deleteRule') {
            await this._configService.deleteRule(message.ruleId);
            this._refreshSettings(webviewView);
            return;
        }
        if (message.type === 'saveProfile') {
            await this._configService.saveProfile(message.data);
            this._refreshSettings(webviewView);
            return;
        }
        if (message.type === 'deleteProfile') {
            await this._configService.deleteProfile(message.profileId);
            this._refreshSettings(webviewView);
            return;
        }

        if (message.type === 'saveDiffConfig') {
            await this._configService.saveDiffConfig(message.data);
            this._refreshSettings(webviewView);
            vscode.window.showInformationMessage('Diff 配置已保存');
            return;
        }

        // --- 3. 数据库相关 ---
        // 2. 原有的保存逻辑 (确保保存后也能触发一些反馈)
        if (message.type === 'saveDbConfig') {
            await this._handleDbSave(webviewView, message.data);
            return;
        }
        if (message.type === 'searchTables') {
            await this._handleTableSearch(webviewView, message.keyword);
            return;
        }

        if (message.type === 'getDbConfig') {
            const config = this._dbService.getConfig(); // 假设你的 DatabaseService 有这个方法
            webviewView.webview.postMessage({
                type: 'dbConfigData',
                config: config || null
            });
            return;
        }

        // --- 4. 工具与日志 ---
        if (message.type === 'log') {
            console.log(`[前端日志 | ${message.tag}]`, message.data);
            return;
        }
        if (message.type === 'info') {
            vscode.window.showInformationMessage(message.value);
            return;
        }
        if (message.type === 'error') {
            vscode.window.showErrorMessage(message.value);
            return;
        }
        if (message.type === 'searchFiles') {
            const files = await this._fileService.searchWorkspaceFiles(message.keyword);
            webviewView.webview.postMessage({ type: 'searchResults', files });
            return;
        }
        if (message.type === 'openFile') {
            await this._fileService.openFile(message.path);
            return;
        }
        if (message.type === 'generate') {
            const prompt = await this._promptService.build(message.data, this._context);
            webviewView.webview.postMessage({ type: 'renderResult', value: prompt });
            return;
        }
    }
}