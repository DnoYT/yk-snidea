import * as vscode from 'vscode';
import * as mysql from 'mysql2/promise';
import * as fs from 'fs';
import * as path from 'path';

export interface DbConfig {
    host: string;
    port: number;
    user: string;
    password?: string;
    database: string;
}

/**
 * 数据库服务：负责 SQL 连接、元数据读取以及配置保存至 .ykide
 */
export class DatabaseService {
    private _config: DbConfig | null = null;
    /**
     * 内部日志打印：使用 console.log 打印到插件调试控制台
     */
    private _log(message: string, data?: any) {
        const timestamp = new Date().toLocaleString();
        const logContent = `[${timestamp}] [DatabaseService] ${message} ${data ? JSON.stringify(data) : ''}`;
        console.log(logContent);
    }

    /**
     * 核心私有方法：获取当前工作区 .ykide/db-config.json 的绝对路径
     */
    private _getConfigPath(): string | undefined {
        const workspaceFolders = vscode.workspace.workspaceFolders;

        // 提前返回：如果未打开任何文件夹
        if (!workspaceFolders || workspaceFolders.length === 0) {
            this._log('未检测到工作区目录，无法定位 .ykide 文件夹');
            return undefined;
        }

        const rootPath = workspaceFolders[0].uri.fsPath;
        const ykideDir = path.join(rootPath, '.ykide');

        // 确保目录存在
        if (!fs.existsSync(ykideDir)) {
            fs.mkdirSync(ykideDir, { recursive: true });
        }

        return path.join(ykideDir, 'db-config.json');
    }

    public getConfig(): DbConfig | null {
        // 修正：不要只依赖内存缓存，或者确保缓存是准确的
        // 这里建议每次重新加载，或者在内存为空时加载
        if (this._config) {
            return this._config;
        }

        const configPath = this._getConfigPath();
        if (configPath && fs.existsSync(configPath)) {
            try {
                const content = fs.readFileSync(configPath, 'utf8');
                this._config = JSON.parse(content);
                return this._config;
            } catch (e) {
                console.error("解析数据库配置文件失败", e);
            }
        }
        return null;
    }

    /**
        * 保存配置到当前工作区
        */
    public async saveConfig(config: DbConfig): Promise<void> {
        this._log('正在保存数据库配置...', { host: config.host, db: config.database });

        const configPath = this._getConfigPath();
        if (!configPath) {
            throw new Error('未找到有效工作区');
        }

        try {
            // 写入文件
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');

            // 【关键修复】：保存成功后，立即更新内存中的缓存
            this._config = config;

            this._log('配置已成功保存并同步到内存');
        } catch (error: any) {
            this._log('保存配置失败', error.message);
            throw error;
        }
    }

    /**
     * 测试连接并返回表列表
     */
    public async testAndGetTables(config: DbConfig): Promise<string[]> {
        let connection;
        try {
            this._log('尝试连接数据库...', { host: config.host, db: config.database });
            connection = await mysql.createConnection({
                host: config.host,
                port: config.port,
                user: config.user,
                password: config.password,
                database: config.database,
                connectTimeout: 5000 // 5秒超时
            });

            this._log('连接成功，正在读取表列表...');
            const [rows]: [any[], any] = await connection.execute('SHOW TABLES');

            // 提取表名
            const tables = rows.map(row => Object.values(row)[0] as string);
            this._log(`获取成功，共 ${tables.length} 张表`);

            await connection.end();
            return tables;
        } catch (error: any) {
            this._log('数据库操作失败！错误详情：', error.message);
            if (connection) {
                await (connection as any).end();
            }
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
            if (connection) {
                await (connection as any).end();
            }
            return `-- [读取失败]: ${tableName}`;
        }
    }
}