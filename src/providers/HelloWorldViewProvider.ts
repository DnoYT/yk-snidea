import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 侧边栏视图提供者
 */
export class HelloWorldViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'yk-snidea.helloView';

    constructor(
        private readonly _extensionUri: vscode.Uri,
    ) { }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview();

        webviewView.webview.onDidReceiveMessage(async (message) => {
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

            // 新增：处理点击 Tag 打开文件的请求
            if (message.type === 'openFile') {
                try {
                    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(message.path));
                    await vscode.window.showTextDocument(document, { preview: false });
                } catch (error) {
                    vscode.window.showErrorMessage(`无法打开文件: ${message.path}`);
                }
                return;
            }

            if (message.type === 'searchFiles') {
                await this._handleSearchFiles(webviewView, message.keyword);
                return;
            }

            if (message.type === 'generate') {
                vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: "正在解析文件并生成提示词...",
                    cancellable: false
                }, async () => {
                    const prompt = await this._buildPrompt(message.data);
                    webviewView.webview.postMessage({ type: 'renderResult', value: prompt });
                });
                return;
            }
        });
    }

    /**
     * 处理文件搜索请求
     * @param {vscode.WebviewView} webviewView - Webview 实例
     * @param {string} keyword - 用户在 @ 后面输入的关键字
     */
    private async _handleSearchFiles(webviewView: vscode.WebviewView, keyword: string): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;

        // 提前返回：如果没有打开工作区，直接返回空列表
        if (!workspaceFolders || workspaceFolders.length === 0) {
            webviewView.webview.postMessage({ type: 'searchResults', files: [] });
            return;
        }

        try {
            // 构建搜索模式，例如用户输入 main，则搜索 **/*main*
            // 如果 keyword 为空，则搜索所有文件 **/*
            const searchPattern = keyword ? `**/*${keyword}*` : `**/*`;
            // 排除 node_modules, dist, .git 等无关文件夹
            const excludePattern = '**/{node_modules,.git,dist,out,.vscode}/**';

            // 限制最多返回 20 条结果，保证性能
            const uris = await vscode.workspace.findFiles(searchPattern, excludePattern, 20);

            // 格式化数据，提取绝对路径和相对路径
            const files = uris.map(uri => ({
                fsPath: uri.fsPath,
                relativePath: vscode.workspace.asRelativePath(uri, false)
            }));

            webviewView.webview.postMessage({ type: 'searchResults', files });
        } catch (error) {
            console.error('[后端报错] 搜索文件失败:', error);
            webviewView.webview.postMessage({ type: 'searchResults', files: [] });
        }
    }

    private _getHtmlForWebview(): string {
        const htmlPath = path.join(this._extensionUri.fsPath, 'media', 'webview.html');
        try {
            return fs.readFileSync(htmlPath, 'utf-8');
        } catch (error) {
            console.error('[后端报错] 无法读取 HTML 文件:', error);
            return `<h2>Error: 无法加载界面文件。</h2>`;
        }
    }

    /**
      * 核心业务逻辑：根据前端传递的参数和文件路径数组，组装提示词
      * @param {any} data - 前端表单数据
      * @returns {Promise<string>} 拼接好的完整提示词
      */
    private async _buildPrompt(data: any): Promise<string> {
        let filesContent = '';

        // 确保传递过来的是数组，且不为空
        if (data.files && Array.isArray(data.files) && data.files.length > 0) {
            for (const finalPath of data.files) {
                const fileName = path.basename(finalPath);
                try {
                    const fileUri = vscode.Uri.file(finalPath);
                    const document = await vscode.workspace.openTextDocument(fileUri);
                    const text = document.getText();

                    // 【关键点】：使用 += 累加多个文件的内容，每个文件用 Markdown 代码块包裹
                    filesContent += `\n### 参考文件: ${fileName}\n\`\`\`\n${text}\n\`\`\`\n`;
                    console.log(`[后端运行] 成功将文件写入提示词: ${fileName}`);
                } catch (error) {
                    filesContent += `\n### [读取失败]: 无法访问文件 ${finalPath}\n`;
                    console.error(`[后端报错] 无法读取文件: ${finalPath}`, error);
                }
            }
        }

        return `
# 角色与技能
${data.skills}

# 开发规范
${data.rules}

# 数据库参考
${data.dbInfo || '无'}

# 核心参考代码
${filesContent || '未提供参考文件'}

# 本次开发需求
${data.requirement || '未提供具体需求'}

---
请严格遵守上述规范，结合提供的上下文，输出包含完整代码文件和 SQL 的解决方案。
        `.trim();
    }
}