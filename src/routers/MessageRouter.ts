import * as vscode from 'vscode';
import { FileService } from '../services/FileService';
import { PromptService } from '../services/PromptService';
import { ConfigService } from '../services/ConfigService';
import { DatabaseService, DbConfig } from '../services/DatabaseService';
import { DiffService } from '../services/DiffService';
import { JsonService } from '../services/JsonService';
import * as path from 'path';
import * as fs from 'fs';

export class MessageRouter {
    private readonly _diffService: DiffService;
    private readonly _jsonService: JsonService;

    constructor(
        private readonly _fileService: FileService,
        private readonly _promptService: PromptService,
        private readonly _configService: ConfigService,
        private readonly _dbService: DatabaseService,
        private readonly _context: vscode.ExtensionContext
    ) {
        this._diffService = new DiffService();
        this._jsonService = new JsonService();
    }

    private _refreshSettings(webviewView: vscode.WebviewView) {
        const diffConfig = this._configService.getDiffConfig();
        const jsonConfig = this._configService.getJsonConfig();

        console.log(`[MessageRouter] 正在同步配置 - DiffPrompt長度: ${diffConfig?.prompt?.length || 0}, JsonPrompt長度: ${jsonConfig?.prompt?.length || 0}`);

        webviewView.webview.postMessage({
            type: 'settingsData',
            roles: this._configService.getRoles(),
            rules: this._configService.getRules(),
            profiles: this._configService.getProfiles(),
            diffConfig: diffConfig,
            jsonConfig: jsonConfig
        });
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
        console.log("[MessageRouter] 收到请求:", message.type, message);

        switch (message.type) {
            // ================= 1. 全局配置与系统设置 =================
            case 'exportSettings':
                await this._configService.exportConfiguration();
                return;

            case 'importSettings':
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

            case 'getSettings':
                this._refreshSettings(webviewView);
                return;

            // ================= 2. Prompt 配置与生成 =================
            case 'getPromptConfig':
                const config = this._configService.getPromptConfig();
                webviewView.webview.postMessage({
                    type: 'promptConfigData',
                    data: config
                });
                return;

            case 'savePromptConfig':
                await this._configService.savePromptConfig(message.data);
                return;

            case 'generate':
                await this._configService.savePromptConfig(message.data);
                const prompt = await this._promptService.build(message.data, this._context);
                webviewView.webview.postMessage({
                    type: 'renderResult',
                    value: prompt
                });
                return;

            case 'savePromptFile':
                try {
                    const firstFile = message.files && message.files.length > 0 ? message.files[0] : 'prompt';
                    const savedPath = await this._configService.savePromptAsMarkdown(message.value, firstFile);
                    const fileName = path.basename(savedPath);
                    vscode.window.showInformationMessage(`保存成功: .ykide/${fileName}`);
                } catch (err: any) {
                    vscode.window.showErrorMessage(`保存失败: ${err.message}`);
                }
                return;


            // ================= 3. 文件处理与代码交互 =================
            case 'applyDiffFromClipboard':
                await this._diffService.applyDiffFromClipboard();
                return;

            case 'applyJsonFromClipboard':
                await this._jsonService.applyJsonFromClipboard();
                return;


            case 'copyToClipboard':
                await vscode.env.clipboard.writeText(message.value);
                vscode.window.showInformationMessage('已复制到剪贴板');
                return;

            case 'searchFiles':
                const files = await this._fileService.searchWorkspaceFiles(message.keyword);
                webviewView.webview.postMessage({ type: 'searchResults', files });
                return;

            case 'openFile':
                await this._fileService.openFile(message.path);
                return;

            // ================= 4. 角色/规则/规范的增删改 =================
            case 'saveRole':
                await this._configService.saveRole(message.data);
                this._refreshSettings(webviewView);
                return;

            case 'deleteRole':
                await this._configService.deleteRole(message.roleId);
                this._refreshSettings(webviewView);
                return;

            case 'saveRule':
                await this._configService.saveRule(message.data);
                this._refreshSettings(webviewView);
                return;

            case 'deleteRule':
                await this._configService.deleteRule(message.ruleId);
                this._refreshSettings(webviewView);
                return;

            case 'saveProfile':
                await this._configService.saveProfile(message.data);
                this._refreshSettings(webviewView);
                return;

            case 'deleteProfile':
                await this._configService.deleteProfile(message.profileId);
                this._refreshSettings(webviewView);
                return;

            case 'saveDiffConfig':
                await this._configService.saveDiffConfig(message.data);
                this._refreshSettings(webviewView);
                vscode.window.showInformationMessage('Diff 配置已保存');
                return;

            case 'saveJsonConfig':
                await this._configService.saveJsonConfig(message.data);
                this._refreshSettings(webviewView);
                vscode.window.showInformationMessage('JSON 配置已保存');
                return;

            case 'resetDiffConfig':
                await this._configService.resetDiffConfig();
                this._refreshSettings(webviewView);
                vscode.window.showInformationMessage('Diff 配置已重置为默认');
                return;

            case 'resetJsonConfig':
                await this._configService.resetJsonConfig();
                this._refreshSettings(webviewView);
                vscode.window.showInformationMessage('JSON 配置已重置为默认');
                return;

            // ================= 5. 数据库交互模块 =================
            case 'saveDbConfig':
                await this._handleDbSave(webviewView, message.data);
                return;

            case 'searchTables':
                await this._handleTableSearch(webviewView, message.keyword);
                return;

            case 'getDbConfig':
                const dbConfig = this._dbService.getConfig();
                webviewView.webview.postMessage({
                    type: 'dbConfigData',
                    config: dbConfig || null
                });
                return;

            // ================= 6. 前端工具与交互反馈 =================
            case 'log':
                console.log(`[前端日志 | ${message.tag}]`, message.data);
                return;

            case 'info':
                vscode.window.showInformationMessage(message.value);
                return;

            case 'error':
                vscode.window.showErrorMessage(message.value);
                return;
            
            default:
                console.log("[MessageRouter] 忽略未知请求类型:", message.type);
                return;
        }
    }
}