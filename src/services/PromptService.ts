import * as vscode from 'vscode';
import * as path from 'path';
import { FileService } from './FileService';
import { DatabaseService } from './DatabaseService';
import { ConfigService } from './ConfigService'; // 引入 ConfigService 来解析 profileId

/**
 * 提示词组装服务
 */
export class PromptService {
    private _fileService: FileService;
    private _dbService = new DatabaseService();
    private _outputChannel: vscode.OutputChannel;

    constructor() {
        this._fileService = new FileService();
        this._outputChannel = vscode.window.createOutputChannel('Snidea-Prompt');
    }
    /**
     * 内部日志记录
     */
    private _log(message: string) {
        const now = new Date().toLocaleString();
        this._outputChannel.appendLine(`[${now}] ${message}`);
        console.log(`[${now}] ${message}`);

    }

    /**
       * 构建最终的 Prompt
       * @param data 前端传来的表单数据
       * @param context 插件上下文
       */
    public async build(data: any, context: vscode.ExtensionContext): Promise<string> {
        this._log('开始拼装提示词...');
        console.log("build data", data);


        // 1. 初始化 ConfigService 来解析 Profile
        const configService = new ConfigService(context);

        // 2. 解析基础信息
        const role = data.skill || data.skills || '你是一个资深的软件工程师。';
        const requirement = data.requirement || '请根据提供的上下文进行代码优化或功能实现。';

        // 3. 关键补全：解析 ProfileId 获取具体的规则文本
        let rules = '';
        if (data.profileId) {
            this._log(`正在解析开发规范 Profile: ${data.profileId}`);
            // 调用你写好的解析逻辑
            rules = configService.resolveProfileToText(data.profileId);
        }

        // 4. 动态获取上下文内容
        this._log(`正在读取数据库表结构: ${data.selectedTables?.join(', ') || '无'}`);
        const dbContext = await this._buildDbSection(data.selectedTables, context);
        const fileContext = await this._buildFilesSection(data.selectedFiles || data.files);

        // 5. 开始动态组装 Prompt
        const promptParts: string[] = [];

        // --- A. 角色与任务 ---
        promptParts.push(`# 角色设定\n${role}`);
        promptParts.push(`# 任务需求\n${requirement}`);

        // --- B. 开发规范 (如果有) ---
        if (rules && rules.trim()) {
            promptParts.push(`# 开发规范\n请在开发过程中严格遵循以下规范：\n${rules}`);
        }

        // --- C. 上下文信息 (如果有) ---
        if (dbContext || fileContext) {
            promptParts.push(`# 上下文信息\n请结合以下提供的业务上下文进行分析和代码编写：`);

            if (dbContext) {
                promptParts.push(`\n## 数据库表结构\n<database>\n${dbContext}\n</database>`);
            }

            if (fileContext) {
                promptParts.push(`\n## 核心参考代码\n<files>\n${fileContext}\n</files>`);
            }
        }

        // --- D. 输出要求 ---
        promptParts.push(`
# 输出要求
1. **理解上下文**：请仔细阅读提供的数据库表结构和代码文件，不要凭空捏造字段、类名或方法。
2. **完整可用**：请输出逻辑完整、可运行的代码片段或完整文件。如果是修改已有代码，请清晰标明修改的位置。
3. **格式规范**：代码部分请使用标准的 Markdown 代码块包裹，并标明对应的语言类型（如 \`\`\`typescript, \`\`\`sql 等）。如果包含 SQL 增删改查语句，请务必保证语法的严谨性。
        `.trim());

        const finalPrompt = promptParts.join('\n\n');

        this._log('提示词拼装完成。');
        return finalPrompt;
    }

    /**
     * 私有方法：构建数据库 Markdown 部分 (如果没有表，返回空字符串)
     */
    private async _buildDbSection(tableNames: string[], context: vscode.ExtensionContext): Promise<string> {
        if (!tableNames || !Array.isArray(tableNames) || tableNames.length === 0) {
            return ''; // 动态逻辑：没有就不返回内容
        }

        const config = this._dbService.getConfig();
        if (!config) {
            this._log('警告：尝试读取表结构但未配置数据库');
            return '<!-- 提示：未配置数据库连接，无法获取表结构 -->';
        }

        let section = '';
        for (const name of tableNames) {
            const ddl = await this._dbService.getTableDDL(config, name);
            section += `\n<!-- Table: ${name} -->\n\`\`\`sql\n${ddl}\n\`\`\`\n`;
        }
        return section.trim();
    }

    /**
     * 私有方法：构建文件参考 Markdown 部分 (如果没有文件，返回空字符串)
     */
    private async _buildFilesSection(filePaths: string[]): Promise<string> {
        if (!filePaths || !Array.isArray(filePaths) || filePaths.length === 0) {
            return ''; // 动态逻辑：没有就不返回内容
        }

        let section = '';
        for (const fsPath of filePaths) {
            try {
                const fileName = path.basename(fsPath);
                // 获取相对于工作区的路径，给 AI 提供更好的目录结构认知
                const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(fsPath));
                const relativePath = workspaceFolder ? path.relative(workspaceFolder.uri.fsPath, fsPath) : fileName;

                const content = await this._fileService.getFileContent(fsPath);
                section += `\n<!-- File: ${relativePath} -->\n\`\`\`\n${content}\n\`\`\`\n`;
            } catch (err) {
                this._log(`读取文件失败: ${fsPath}`);
            }
        }
        return section.trim();
    }
}