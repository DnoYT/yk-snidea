import * as path from 'path';
import { FileService } from './FileService';

/**
 * 提示词组装服务：负责将各种碎片信息拼装成最终 Markdown
 */
export class PromptService {
    private _fileService: FileService;

    constructor() {
        this._fileService = new FileService();
    }

    /**
     * 构建最终的 Prompt
     * @param data 前端传来的表单数据
     */
    public async build(data: any): Promise<string> {
        // 1. 获取并处理关联的文件内容
        const filesMarkdown = await this._buildFilesSection(data.files);

        // 2. 组合模板 (使用 Early Return 思想处理可选字段)
        const skills = data.skills || '你是一个资深的软件工程师，请根据以下上下文完成开发任务。';
        const rules = data.rules || '暂无特定开发规范。';
        const dbInfo = data.dbInfo || '未连接数据库或未选择表结构。';
        const requirement = data.requirement || '请根据提供的上下文进行代码优化或功能实现。';

        // 3. 最终组装
        const prompt = `
# 角色与技能
${skills}

# 开发规范
${rules}

# 数据库参考
${dbInfo}

# 核心参考代码
${filesMarkdown}

# 本次开发需求
${requirement}

---
请严格遵守上述规范，结合提供的上下文，输出包含完整代码文件和 SQL 的解决方案。
        `.trim();

        return prompt;
    }

    /**
     * 私有方法：循环读取文件并转为 Markdown 代码块
     */
    private async _buildFilesSection(filePaths: string[]): Promise<string> {
        // 提前返回
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