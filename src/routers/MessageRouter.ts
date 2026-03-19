import * as vscode from 'vscode';
import { FileService } from '../services/FileService';
import { PromptService } from '../services/PromptService';
import { ConfigService } from '../services/ConfigService';
import { DatabaseService, DbConfig } from '../services/DatabaseService';
import * as path from 'path';

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
            profiles: this._configService.getProfiles()
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
        console.log("[MessageRouter] 收到请求:", message.type);

        if (message.type === 'exportSettings') {
            await this._configService.exportConfiguration();
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