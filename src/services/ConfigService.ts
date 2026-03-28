import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface Role {
    id: string;
    name: string;
    content: string; // 存储具体的 System Prompt
}
export interface Rule { id: string; name: string; content: string; }
export interface Profile { id: string; name: string; ruleIds: string[]; }

export class ConfigService {
    private readonly ROLES_KEY = 'yk-snidea.roles';
    private readonly RULES_KEY = 'yk-snidea.rules';
    private readonly PROFILES_KEY = 'yk-snidea.profiles';
    private readonly DIFF_CONFIG_KEY = 'yk-snidea.diffConfig';
    private readonly JSON_CONFIG_KEY = 'yk-snidea.jsonConfig';

    constructor(private readonly _context: vscode.ExtensionContext) { }

    // --- 通用获取方法 ---
    public getRoles(): Role[] { return this._context.globalState.get<Role[]>(this.ROLES_KEY, []); }
    public getRules(): Rule[] { return this._context.globalState.get<Rule[]>(this.RULES_KEY, []); }
    public getProfiles(): Profile[] { return this._context.globalState.get<Profile[]>(this.PROFILES_KEY, []); }

    public async savePromptAsMarkdown(content: string, firstFileName: string = 'prompt'): Promise<string> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            throw new Error('未找到工作区');
        }

        const rootPath = workspaceFolders[0].uri.fsPath;
        const ykideDir = path.join(rootPath, '.ykide');
        if (!fs.existsSync(ykideDir)) {
            fs.mkdirSync(ykideDir);
        }

        // 清理文件名中的非法字符
        const safeBaseName = path.basename(firstFileName).replace(/[\\/:*?"<>|]/g, '_');

        // 计算序号：查找已存在的文件 {{name}}_{{index}}.md
        let index = 1;
        let finalPath = '';
        while (true) {
            const fileName = `${safeBaseName}_${index}.md`;
            finalPath = path.join(ykideDir, fileName);
            if (!fs.existsSync(finalPath)) {
                break;
            }
            index++;
        }

        fs.writeFileSync(finalPath, content, 'utf-8');
        return finalPath;
    }


    private _getPromptConfigPath(): string | undefined {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return undefined;
        }
        const rootPath = workspaceFolders[0].uri.fsPath;
        const dir = path.join(rootPath, '.ykide');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        return path.join(dir, 'prompt-config.json');
    }

    // 保存主界面配置
    public async savePromptConfig(data: any): Promise<void> {
        const filePath = this._getPromptConfigPath();
        if (!filePath) { return; };

        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    }

    // 获取主界面配置
    public getPromptConfig(): any {
        const filePath = this._getPromptConfigPath();
        if (filePath && fs.existsSync(filePath)) {
            try {
                return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            } catch (e) {
                return null;
            }
        }
        return null;
    }


    // --- 角色管理 (Roles) ---
    public async saveRole(role: Role): Promise<void> {
        const data = this.getRoles();
        const index = data.findIndex(item => item.id === role.id);

        if (index > -1) {
            data[index] = role;
            await this._context.globalState.update(this.ROLES_KEY, [...data]);
            return;
        }
        await this._context.globalState.update(this.ROLES_KEY, [...data, role]);
    }

    public async deleteRole(id: string): Promise<void> {
        const filtered = this.getRoles().filter(item => item.id !== id);
        await this._context.globalState.update(this.ROLES_KEY, filtered);
    }

    // --- 规则管理 (Rules) ---
    public async saveRule(rule: Rule): Promise<void> {
        const data = this.getRules();
        const index = data.findIndex(item => item.id === rule.id);

        if (index > -1) {
            data[index] = rule;
            await this._context.globalState.update(this.RULES_KEY, [...data]);
            return;
        }
        await this._context.globalState.update(this.RULES_KEY, [...data, rule]);
    }

    public async deleteRule(id: string): Promise<void> {
        const filtered = this.getRules().filter(item => item.id !== id);
        await this._context.globalState.update(this.RULES_KEY, filtered);
    }

    // --- Diff 配置管理 ---
    public getDiffConfig(): any {
        return this._context.globalState.get(this.DIFF_CONFIG_KEY, {
            enabled: true,
            prompt: `*** CRITICAL OUTPUT FORMATTING INSTRUCTIONS ***\n(Append this to the very end of your responses, ensuring seamless integration into the developer's workflow.)\n\nTo prevent the web browser UI from rendering git-conflict markers or diff formatting, you MUST strictly adhere to the following raw text rules. \n\n1. **STRICT RAW TEXT BLOCKS:** Every single modification must be enclosed in a \`\`\`text ... \`\`\` block. ABSOLUTELY DO NOT use \`\`\`diff\`, \`\`\`javascript\`, \`\`\`html\`, or any other language tag. \n2. **EXACT SEARCH/REPLACE TEMPLATE:**\n   File: [Relative/File/Path.ext]\n   <<<<<<< SEARCH\n   [Insert EXACT existing code here. Must include 3-5 lines of unchanged context to ensure global uniqueness for Ctrl+F/Cmd+F]\n   =======\n   [Insert modified code here]\n   >>>>>>> REPLACE\n\n3. **NEW FILES:** If creating a new file, leave the SEARCH block completely empty (i.e., immediately place \`=======\` below \`<<<<<<< SEARCH\`).\n4. **NO TRUNCATION & NO REDUNDANCY:** Do not output the entire file. Only output the modified chunks. Do not add explanatory comments inside the code block unless they belong to the actual source code.\n5. **RESPONSE STRUCTURE:**\n   - **Phase 1 (Before code):** Briefly list the root causes of the issue using bullet points (-).\n   - **Phase 2 (The Code):** Output ONLY the raw text blocks formatted exactly as above.\n   - **Phase 3 (After code):** Briefly explain the next steps, any missing files, or pending logic that needs to be addressed.`
        });
    }

    public async saveDiffConfig(config: any): Promise<void> {
        await this._context.globalState.update(this.DIFF_CONFIG_KEY, config);
    }

    // --- JSON 配置管理 ---
    public getJsonConfig(): any {
        const fallbackPrompt = `### SYSTEM: STRUCTURED JSON UPDATE PROTOCOL ###\n\nYou must output all file modifications as a single, valid JSON object. This is for programmatic parsing. \n\n**1. OUTPUT FORMAT:**\nWrap the final JSON in a single \`\`\`json ... \`\`\` code block.\n\n**2. JSON SCHEMA:**\nThe JSON must follow this structure:\n{\n  "changes": [\n    {\n      "file": "path/to/file.ext",\n      "action": "replace", \n      "search": "exact text to find",\n      "replace": "new text to insert"\n    }\n  ]\n}\n*Note: Use "action": "create" for new files (leave "search" empty).*\n\n**3. CRITICAL RULES:**\n- **NO ESCAPING ERRORS:** Ensure all newlines in the code are represented as \\n and double quotes are correctly escaped as \\" within the JSON strings.\n- **UNIQUENESS:** The \`search\` string must be long enough (3-5 lines of context) to be globally unique within the file.\n- **NO COMMENTARY:** Do not include any text outside the JSON block unless explicitly asked for a summary.`;

        const config = this._context.globalState.get<any>(this.JSON_CONFIG_KEY);

        // 提前返回：如果已有配置且包含內容，則直接返回
        if (config && config.prompt) {
            return config;
        }

        // 否則返回默認結構
        return {
            enabled: true,
            prompt: fallbackPrompt
        };
    }

    public async saveJsonConfig(config: any): Promise<void> {
        await this._context.globalState.update(this.JSON_CONFIG_KEY, config);
    }

    public async resetDiffConfig(): Promise<void> {
        await this._context.globalState.update(this.DIFF_CONFIG_KEY, undefined);
    }

    public async resetJsonConfig(): Promise<void> {
        await this._context.globalState.update(this.JSON_CONFIG_KEY, undefined);
    }

    // --- 规范管理 (Profiles) ---
    public async saveProfile(profile: Profile): Promise<void> {
        const data = this.getProfiles();
        const index = data.findIndex(item => item.id === profile.id);

        if (index > -1) {
            data[index] = profile;
            await this._context.globalState.update(this.PROFILES_KEY, [...data]);
            return;
        }
        await this._context.globalState.update(this.PROFILES_KEY, [...data, profile]);
    }

    public async deleteProfile(id: string): Promise<void> {
        const filtered = this.getProfiles().filter(item => item.id !== id);
        await this._context.globalState.update(this.PROFILES_KEY, filtered);
    }

    /**
     * 初次安装：自动导入初始化配置 (供 extension.ts 激活时调用)
     */
    public async initDefaultsIfNeeded(): Promise<void> {
        const isInitialized = this._context.globalState.get<boolean>('yk-snidea.initialized', false);
        if (isInitialized) {
            return;
        }

        const initJsonPath = path.join(this._context.extensionPath, 'init.json');
        if (!fs.existsSync(initJsonPath)) {
            return;
        }

        try {
            const content = fs.readFileSync(initJsonPath, 'utf-8');
            const parsed = JSON.parse(content);

            if (parsed.roles) { await this._context.globalState.update(this.ROLES_KEY, parsed.roles); }
            if (parsed.rules) { await this._context.globalState.update(this.RULES_KEY, parsed.rules); }
            if (parsed.profiles) { await this._context.globalState.update(this.PROFILES_KEY, parsed.profiles); }
            if (parsed.diffConfig) { await this._context.globalState.update(this.DIFF_CONFIG_KEY, parsed.diffConfig); }
            if (parsed.jsonConfig) { await this._context.globalState.update(this.JSON_CONFIG_KEY, parsed.jsonConfig); }

            await this._context.globalState.update('yk-snidea.initialized', true);
            console.log("[ConfigService] 首次安装，已成功导入基础配置。");
        } catch (e) {
            console.error("初始化配置文件解析失败", e);
        }
    }

    // --- 核心解析逻辑 ---
    public resolveProfileToText(profileId: string): string {
        const profile = this.getProfiles().find(p => p.id === profileId);
        if (!profile) {
            return '未绑定特定开发规范。';
        }

        const allRules = this.getRules();
        const activeRules = profile.ruleIds
            .map(id => allRules.find(r => r.id === id))
            .filter(r => !!r) as Rule[];

        if (activeRules.length === 0) {
            return '该规范下暂无具体规则内容。';
        }

        return activeRules.map((r, i) => `${i + 1}. ${r.content}`).join('\n');
    }

    /**
     * 导出所有配置到当前工作区的 .ykide 文件夹
     */
    public async exportConfiguration(): Promise<void> {
        console.log("导出到配置");

        const workspaceFolders = vscode.workspace.workspaceFolders;

        // 提前返回：未打开文件夹
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('未找到有效工作区，无法导出配置');
            return;
        }

        const rootPath = workspaceFolders[0].uri.fsPath;
        const targetDir = path.join(rootPath, '.ykide');

        // 确保目录存在 (无 else)
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        // 构造数据
        const exportData = {
            version: "1.0.0",
            exportTime: new Date().toLocaleString(),
            roles: this.getRoles(),
            rules: this.getRules(),
            profiles: this.getProfiles()
        };

        // 构造文件名: yk-ide_202603191256.json
        const timeStr = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
        const fileName = `yk-ide_${timeStr}.json`;
        const filePath = path.join(targetDir, fileName);

        try {
            fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2), 'utf-8');

            // 弹出成功提示并提供“打开文件夹”按钮
            const action = await vscode.window.showInformationMessage(
                `配置已成功导出至: .ykide/${fileName}`,
                '打开文件夹'
            );

            if (action === '打开文件夹') {
                vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(filePath));
            }
        } catch (error: any) {
            vscode.window.showErrorMessage(`导出失败: ${error.message}`);
        }
    }
}