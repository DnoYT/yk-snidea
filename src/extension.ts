import * as vscode from 'vscode';
// 引入我们刚才写的 Provider 类
import { HelloWorldViewProvider } from './providers/HelloWorldViewProvider';
import { initIdeFolder } from './utils/fileSystem';

// 插件被激活时执行的函数
export function activate(context: vscode.ExtensionContext) {
	console.log('yk-side 插件已激活！');

	// 1. 实例化我们的 WebviewView 提供者
	const provider = new HelloWorldViewProvider(context.extensionUri);

	// 2. 注册这个提供者到 VS Code 窗口系统
	// 传入的 ID (HelloWorldViewProvider.viewType) 必须匹配 package.json 里的设定
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(HelloWorldViewProvider.viewType, provider)
	);

	// 3. （可选）保留之前的命令注册逻辑
	let disposable = vscode.commands.registerCommand('yk-snidea.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from yk-side 命令!');
	});
	context.subscriptions.push(disposable);


	// 注册创建 .ide 文件夹的命令
	const initIdeDisposable = vscode.commands.registerCommand('yk-snidea.initIde', async () => {
		await initIdeFolder();
	});

	context.subscriptions.push(initIdeDisposable);
}

// 插件被卸载或停用时执行的函数
export function deactivate() { }