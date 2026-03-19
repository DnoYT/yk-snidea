/**
 * 封装 VS Code Webview 通信机制 (纯 JS)
 */

// 获取 VS Code API，只执行一次
const vscode = window.acquireVsCodeApi ? window.acquireVsCodeApi() : null;

export const vscodeApi = {
    /**
     * 向 VS Code 后端发送消息
     * @param {Object} message 
     */
    postMessage(message) {
        if (!vscode) {
            console.warn('不在 VS Code 环境中，无法发送消息:', message);
            return;
        }
        vscode.postMessage(message);
    },

    /**
     * 监听来自 VS Code 后端的消息
     * @param {Function} callback 
     */
    onMessage(callback) {
        window.addEventListener('message', (event) => {
            const message = event.data;
            if (!message) {
                return;
            }
            callback(message);
        });
    }
};