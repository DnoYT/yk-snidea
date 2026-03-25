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
    // --- Diff 配置管理 ---
    public getDiffConfig(): any {
        return this._context.globalState.get(this.DIFF_CONFIG_KEY, {
            enabled: true,
            prompt: `为了方便我直接复制并在编辑器中替换，请严格遵守以下输出格式：\n\n- **独立代码块:** 每一个修改点（SEARCH/REPLACE）必须单独包裹在 \`\`\`text ... \`\`\` 标签中。\n- **格式模板:**\n    文件：[文件相对路径]\n    <<<<<<< SEARCH\n    [此处放原文件中现有的、精确的代码片段，包含缩进]\n    =======\n    [此处放修改后的代码片段]\n    >>>>>>> REPLACE\n\n- **新建文件支持:** 如果你需要创建新文件，请保持 SEARCH 块为空（即 \`<<<<<<< SEARCH\` 下方直接接 \`=======\`），并在 REPLACE 块中写上新文件的完整代码。\n- **SEARCH 块唯一性:** SEARCH 片段必须包含足够的上下文（3-5行），确保我在 VS Code 中 Ctrl+F 搜索时是全局唯一的。\n- **禁止输出冗余:** 除了必要的“修改说明”外，不要在代码块内输出任何解释。禁止输出未修改的完整文件。\n\n在给出代码块之前，请先用简短的符号列表形式（如 - ）指出问题原因。\n在代码块之后，你可以继续做说明，或者说还要ai做说明，还差什么文件，接下来的计划是什么。`
        });
    }

    public async saveDiffConfig(config: any): Promise<void> {
        await this._context.globalState.update(this.DIFF_CONFIG_KEY, config);
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