import * as vscode from 'vscode';
import { getWebviewHtml } from '../utils/htmlGenerator';
// 预留服务层导入（稍后我们会创建这些文件）
import { FileService } from '../services/FileService';
import { PromptService } from '../services/PromptService';

/**
 * 侧边栏视图提供者：负责 Webview 生命周期管理与消息中转
 */
export class SnideaViewProvider implements vscode.WebviewViewProvider {

    private readonly _fileService = new FileService();
    private readonly _promptService = new PromptService();

    // 必须与 package.json 中的视图 ID 一致
    public static readonly viewType = 'yk-snidea.helloView';

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _context: vscode.ExtensionContext
    ) { }

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

    /**
     * 消息路由处理器
     * 严格遵守 Early Return 模式，禁止使用 else
     */
    private async _handleMessageBus(webviewView: vscode.WebviewView, message: any) {
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
            const prompt = await this._promptService.build(message.data);
            webviewView.webview.postMessage({ type: 'renderResult', value: prompt });
            return;
        }

        // 后续扩展：数据库相关路由
        if (message.type === 'searchTables') {
            // TODO: 调用 DatabaseService
            return;
        }
    }

    /**
     * 临时逻辑处理函数（后续将逻辑移入 Service）
     */
    private async _onOpenFile(filePath: string) {
        if (!filePath) return;

        try {
            const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
            await vscode.window.showTextDocument(document, { preview: false });
        } catch (error) {
            vscode.window.showErrorMessage(`无法打开文件: ${filePath}`);
        }
    }

    private async _onSearchFiles(webviewView: vscode.WebviewView, keyword: string) {
        // 这里暂时保留简单逻辑，稍后我们会将其放入 FileService.ts
        const searchPattern = keyword ? `**/*${keyword}*` : `**/*`;
        const excludePattern = '**/{node_modules,.git,dist,out,.vscode}/**';
        const uris = await vscode.workspace.findFiles(searchPattern, excludePattern, 20);

        const files = uris.map(uri => ({
            fsPath: uri.fsPath,
            relativePath: vscode.workspace.asRelativePath(uri, false)
        }));

        webviewView.webview.postMessage({ type: 'searchResults', files });
    }

    private async _onGeneratePrompt(webviewView: vscode.WebviewView, data: any) {
        // 进度条提示
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "正在构建 Snidea 提示词...",
            cancellable: false
        }, async () => {
            // 此处逻辑后续由 PromptService.build(data) 接管
            // 暂时模拟返回
            const mockPrompt = `生成的提示词内容...`;
            webviewView.webview.postMessage({ type: 'renderResult', value: mockPrompt });
        });
    }
}