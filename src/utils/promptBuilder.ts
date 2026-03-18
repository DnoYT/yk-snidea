// src/utils/promptBuilder.ts
export interface PromptContext {
    skills: string;
    rules: string;
    dbSchema: string;
    originalCode: string;
    requirement: string;
}

export function buildFinalPrompt(context: PromptContext): string {
    // 使用模板字符串进行纯文本拼接
    const promptTemplate = `
# 角色与技能
${context.skills}

# 开发规范
${context.rules}

# 数据库结构参考
\`\`\`sql
${context.dbSchema}
\`\`\`

# 原始代码文件
\`\`\`
${context.originalCode}
\`\`\`

# 本次开发需求
${context.requirement}

请严格遵守上述规范，输出包含代码文件和 SQL 的完整解决方案。
`;

    return promptTemplate.trim();
}