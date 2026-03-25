import * as vscode from 'vscode';
import { SnideaViewProvider } from './providers/SnideaViewProvider';
import { initIdeFolder } from './utils/fileSystem';
import { ConfigService } from './services/ConfigService';

/**
 * 插件激活入口
 */
export async function activate(context: vscode.ExtensionContext) {
	console.log('yk-snidea 插件已激活！');

	// 1. 初始化默认配置 (首次安装自动载入 init.json)
	const configService = new ConfigService(context);
	await configService.initDefaultsIfNeeded();

	// 2. 实例化 Provider
	// 后续如果有全局状态管理，可以在这里通过 context 传入
	const provider = new SnideaViewProvider(context.extensionUri, context);

	// 3. 注册侧边栏 Webview 视图
	// 注意：这里的 'yk-snidea.helloView' 对应 package.json 中的 views 里的 ID
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(SnideaViewProvider.viewType, provider)
	);

	// 4. 注册初始化 .ykide 配置文件夹命令
	const initIdeDisposable = vscode.commands.registerCommand('yk-snidea.initIde', async () => {
		await initIdeFolder();
	});

	context.subscriptions.push(initIdeDisposable);
}

export function deactivate() { }