import * as vscode from 'vscode';
import { getWebviewHtml } from '../utils/htmlGenerator';
// 预留服务层导入（稍后我们会创建这些文件）
import { FileService } from '../services/FileService';
import { PromptService } from '../services/PromptService';
import { ConfigService } from '../services/ConfigService';
import { DatabaseService, DbConfig } from '../services/DatabaseService';

/**
 * 侧边栏视图提供者：负责 Webview 生命周期管理与消息中转
 */
export class SnideaViewProvider implements vscode.WebviewViewProvider {

    private readonly _fileService = new FileService();
    private readonly _promptService = new PromptService();
    private readonly _configService: ConfigService;
    private readonly _dbService = new DatabaseService();

    // 必须与 package.json 中的视图 ID 一致
    public static readonly viewType = 'yk-snidea.helloView';

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _context: vscode.ExtensionContext
    ) {
        // 初始化配置服务
        this._configService = new ConfigService(_context);
    }

    /**
     * 实现 resolveWebviewView 方法，初始化 Webview 内容
     */
    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        // 使用抽离出的工具函数生成 HTML
        webviewView.webview.html = getWebviewHtml(webviewView.webview, this._extensionUri);

        // 核心消息总线
        webviewView.webview.onDidReceiveMessage(async (message) => {
            await this._handleMessageBus(webviewView, message);
        });
    }

    private _refreshSettings(webviewView: vscode.WebviewView) {
        webviewView.webview.postMessage({
            type: 'settingsData',
            rules: this._configService.getRules(),
            profiles: this._configService.getProfiles()
        });
    }

    private async _handleDbSave(webviewView: vscode.WebviewView, config: DbConfig) {
        try {
            await this._dbService.saveConfig(this._context, config);
            const tables = await this._dbService.testAndGetTables(config);

            vscode.window.showInformationMessage('数据库连接成功！');
            webviewView.webview.postMessage({ type: 'dbStatus', success: true, tables });
        } catch (err: any) {
            vscode.window.showErrorMessage(`连接失败: ${err.message}`);
            webviewView.webview.postMessage({ type: 'dbStatus', success: false });
        }
    }

    private async _handleTableSearch(webviewView: vscode.WebviewView, keyword: string) {
        const config = this._dbService.getConfig(this._context);
        if (!config) {
            webviewView.webview.postMessage({ type: 'tableResults', tables: [] });
            return;
        }

        try {
            const allTables = await this._dbService.testAndGetTables(config);
            // 简单模糊过滤
            const filtered = allTables.filter(t => t.includes(keyword || ''));
            webviewView.webview.postMessage({ type: 'tableResults', tables: filtered });
        } catch (err) {
            webviewView.webview.postMessage({ type: 'tableResults', tables: [] });
        }
    }

    /**
     * 消息路由处理器
     * 严格遵守 Early Return 模式，禁止使用 else
     */
    private async _handleMessageBus(webviewView: vscode.WebviewView, message: any) {

        // 1. 保存并测试数据库连接
        if (message.type === 'saveDbConfig') {
            await this._handleDbSave(webviewView, message.data);
            return;
        }

        // 2. 搜索数据库表 (对应前端输入 @ 时的逻辑)
        if (message.type === 'searchTables') {
            await this._handleTableSearch(webviewView, message.keyword);
            return;
        }


        // 获取全部配置数据（初始化 Webview 时调用）
        if (message.type === 'getSettings') {
            webviewView.webview.postMessage({
                type: 'settingsData',
                rules: this._configService.getRules(),
                profiles: this._configService.getProfiles()
            });
            return;
        }

        // 保存规则
        if (message.type === 'saveRule') {
            await this._configService.saveRule(message.data);
            // 保存后刷新前端数据
            this._refreshSettings(webviewView);
            return;
        }

        // 保存规范绑定
        if (message.type === 'saveProfile') {
            await this._configService.saveProfile(message.data);
            this._refreshSettings(webviewView);
            return;
        }


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

        // 搜索文件
        if (message.type === 'searchFiles') {
            const files = await this._fileService.searchWorkspaceFiles(message.keyword);
            webviewView.webview.postMessage({ type: 'searchResults', files });
            return;
        }

        // 打开文件
        if (message.type === 'openFile') {
            await this._fileService.openFile(message.path);
            return;
        }

        // 生成提示词
        if (message.type === 'generate') {
            // 关键点：增加第二个参数 this._context
            const prompt = await this._promptService.build(message.data, this._context);

            webviewView.webview.postMessage({
                type: 'renderResult',
                value: prompt
            });
            return;
        }

        // 后续扩展：数据库相关路由
        if (message.type === 'searchTables') {
            // TODO: 调用 DatabaseService
            return;
        }
    }


}