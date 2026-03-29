import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * 日志服务：负责在 .ykide/log 下记录运行日志
 */
export class LoggerService {
    /**
     * 写入日志条目到当前的日期文件中
     * @param message 日志消息
     * @param level 级别：INFO | WARN | ERROR
     */
    public static log(message: string, level: 'INFO' | 'WARN' | 'DEBUG' | 'ERROR' = 'INFO'): void {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) return;

        const rootPath = workspaceFolders[0].uri.fsPath;
        const logDir = path.join(rootPath, '.ykide', 'log');
        
        this._ensureDirExists(logDir);

        const fileName = `${this._getFormattedDate()}.log`;
        const filePath = path.join(logDir, fileName);
        const timestamp = new Date().toLocaleString();
        const logLine = `[${timestamp}] [${level}] ${message}\n`;
        console.log(logLine);


        try {
            fs.appendFileSync(filePath, logLine, 'utf-8');
        } catch (err) {
            console.error('Failed to write log:', err);
        }
    }

    private static _getFormattedDate(): string {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}${month}${day}`;
    }

    private static _ensureDirExists(dir: string): void {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
}