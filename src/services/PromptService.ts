import * as vscode from 'vscode';
import * as path from 'path';
import { FileService } from './FileService';
import { DatabaseService } from './DatabaseService';

/**
 * 提示词组装服务
 */
export class PromptService {
    private _fileService: FileService;
    private _dbService = new DatabaseService();
    private _outputChannel: vscode.OutputChannel;

    constructor() {
        this._fileService = new FileService();
        // 创建提示词服务的日志通道
        this._outputChannel = vscode.window.createOutputChannel('Snidea-Prompt');
    }

    /**
     * 内部日志记录
     */
    private _log(message: string) {
        const now = new Date().toLocaleString();
        this._outputChannel.appendLine(`[${now}] ${message}`);
    }

    /**
     * 构建最终的 Prompt
     * @param data 前端传来的表单数据
     * @param context 插件上下文（必须从外部传入）
     */
    public async build(data: any, context: vscode.ExtensionContext): Promise<string> {
        this._log('开始拼装提示词...');

        // 1. 获取并处理关联的文件内容
        const filesMarkdown = await this._buildFilesSection(data.files);

        // 2. 处理可选字段的默认值
        const skills = data.skills || '你是一个资深的软件工程师，请根据以下上下文完成开发任务。';
        const rules = data.rules || '暂无特定开发规范。';
        const requirement = data.requirement || '请根据提供的上下文进行代码优化或功能实现。';

        // 3. 处理数据库部分（修复 context 未定义的问题）
        this._log(`正在读取数据库表结构: ${data.selectedTables?.join(', ') || '无'}`);
        const dbMarkdown = await this._buildDbSection(data.selectedTables, context);

        // 4. 最终组装
        const prompt = `
# 角色与技能
${skills}

# 开发规范
${rules}

# 数据库参考
${dbMarkdown}

# 核心参考代码
${filesMarkdown}

# 本次开发需求
${requirement}

---
请严格遵守上述规范，结合提供的上下文，输出包含完整代码文件和 SQL 的解决方案。
        `.trim();

        this._log('提示词拼装完成。');
        return prompt;
    }

    /**
     * 私有方法：构建数据库 Markdown 部分
     */
    private async _buildDbSection(tableNames: string[], context: vscode.ExtensionContext): Promise<string> {
        // 提前返回
        if (!tableNames || !Array.isArray(tableNames) || tableNames.length === 0) {
            return '未提供数据库参考';
        }

        const config = this._dbService.getConfig(context);
        if (!config) {
            this._log('警告：尝试读取表结构但未配置数据库');
            return '未配置数据库信息';
        }

        let section = '';
        for (const name of tableNames) {
            const ddl = await this._dbService.getTableDDL(config, name);
            section += `\n### 表结构: ${name}\n\`\`\`sql\n${ddl}\n\`\`\`\n`;
        }
        return section;
    }

    /**
     * 私有方法：构建文件参考 Markdown 部分
     */
    private async _buildFilesSection(filePaths: string[]): Promise<string> {
        if (!filePaths || !Array.isArray(filePaths) || filePaths.length === 0) {
            return '未提供参考文件';
        }

        let section = '';
        for (const fsPath of filePaths) {
            const fileName = path.basename(fsPath);
            const content = await this._fileService.getFileContent(fsPath);
            section += `\n### 参考文件: ${fileName}\n\`\`\`\n${content}\n\`\`\`\n`;
        }
        return section;
    }
}