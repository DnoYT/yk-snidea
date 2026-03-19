import * as vscode from 'vscode';
import { getWebviewHtml } from '../utils/htmlGenerator';
import { FileService } from '../services/FileService';
import { PromptService } from '../services/PromptService';
import { ConfigService } from '../services/ConfigService';
import { DatabaseService } from '../services/DatabaseService';
import { MessageRouter } from '../routers/MessageRouter'; // 引入路由

export class SnideaViewProvider implements vscode.WebviewViewProvider {
    private readonly _fileService = new FileService();
    private readonly _promptService = new PromptService();
    private readonly _configService: ConfigService;
    private readonly _dbService = new DatabaseService();
    private readonly _messageRouter: MessageRouter; // 声明路由实例

    public static readonly viewType = 'yk-snidea.helloView';

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _context: vscode.ExtensionContext
    ) {
        this._configService = new ConfigService(_context);

        // 实例化路由，并将需要的服务传递进去
        this._messageRouter = new MessageRouter(
            this._fileService,
            this._promptService,
            this._configService,
            this._dbService,
            this._context
        );
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = getWebviewHtml(webviewView.webview, this._extensionUri);

        // 核心消息总线委托给 MessageRouter
        webviewView.webview.onDidReceiveMessage(async (message) => {
            await this._messageRouter.handleMessage(webviewView, message);
        });
    }
}