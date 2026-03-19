import * as vscode from 'vscode';
import * as mysql from 'mysql2/promise';

export interface DbConfig {
    host: string;
    port: number;
    user: string;
    password?: string;
    database: string;
}

/**
 * 数据库服务：负责 SQL 连接与元数据读取
 */
export class DatabaseService {
    private readonly DB_CONFIG_KEY = 'yk-snidea.dbConfig';
    private _outputChannel: vscode.OutputChannel;

    constructor() {
        // 创建专属输出通道，方便定位问题
        this._outputChannel = vscode.window.createOutputChannel('Snidea-Database');
    }

    /**
     * 内部日志打印：带时间戳，方便用户复制
     */
    private _log(message: string, data?: any) {
        const timestamp = new Date().toLocaleString();
        const logContent = `[${timestamp}] ${message} ${data ? JSON.stringify(data) : ''}`;
        this._outputChannel.appendLine(logContent);
        // 如果有严重错误，直接展示面板
        if (message.includes('失败') || message.includes('Error')) {
            this._outputChannel.show(true);
        }
    }

    /**
     * 获取当前工作区的数据库配置
     */
    public getConfig(context: vscode.ExtensionContext): DbConfig | undefined {
        return context.workspaceState.get<DbConfig>(this.DB_CONFIG_KEY);
    }

    /**
     * 保存配置到当前工作区
     */
    public async saveConfig(context: vscode.ExtensionContext, config: DbConfig) {
        this._log('正在保存数据库配置...', { host: config.host, db: config.database });
        await context.workspaceState.update(this.DB_CONFIG_KEY, config);
        this._log('配置保存成功');
    }

    /**
     * 测试连接并返回表列表
     */
    public async testAndGetTables(config: DbConfig): Promise<string[]> {
        let connection;
        try {
            this._log('尝试连接数据库...', { host: config.host });
            connection = await mysql.createConnection({
                host: config.host,
                port: config.port,
                user: config.user,
                password: config.password,
                database: config.database,
                connectTimeout: 5000
            });

            this._log('连接成功，正在读取表列表...');
            const [rows]: [any[], any] = await connection.execute('SHOW TABLES');

            // 提取表名（适配不同版本的 Key 名）
            const tables = rows.map(row => Object.values(row)[0] as string);
            this._log(`获取成功，共 ${tables.length} 张表`);

            await connection.end();
            return tables;
        } catch (error: any) {
            this._log('数据库操作失败！错误详情：', error.message);
            if (connection) await (connection as any).end();
            throw error;
        }
    }

    /**
     * 获取指定表的 DDL (Create Table 语句)
     */
    public async getTableDDL(config: DbConfig, tableName: string): Promise<string> {
        let connection;
        try {
            connection = await mysql.createConnection({
                host: config.host,
                port: config.port,
                user: config.user,
                password: config.password,
                database: config.database
            });

            this._log(`正在读取表结构: ${tableName}`);
            const [rows]: [any[], any] = await connection.execute(`SHOW CREATE TABLE \`${tableName}\``);

            const ddl = rows[0]['Create Table'] || '';
            await connection.end();
            return ddl;
        } catch (error: any) {
            this._log(`读取表 ${tableName} 结构失败:`, error.message);
            if (connection) await (connection as any).end();
            return `-- [读取失败]: ${tableName}`;
        }
    }
}