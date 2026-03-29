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

/**
 * 配置管理服务：处理全局状态持久化及工作区配置导出
 */
export class ConfigService {
    private readonly ROLES_KEY = 'yk-snidea.roles';
    private readonly RULES_KEY = 'yk-snidea.rules';
    private readonly PROFILES_KEY = 'yk-snidea.profiles';
    private readonly DIFF_CONFIG_KEY = 'yk-snidea.diffConfig';
    private readonly JSON_CONFIG_KEY = 'yk-snidea.jsonConfig';
    private readonly XML_CONFIG_KEY = 'yk-snidea.xmlConfig';

    constructor(private readonly _context: vscode.ExtensionContext) { }

    /**
     * 从资源目录读取默认提示词，失败则返回降级文本
     */
    private _getDefaultPrompt(filename: string, fallback: string): string {
        const filePath = path.join(this._context.extensionPath, 'resources', 'prompts', filename);

        if (!fs.existsSync(filePath)) {
            return fallback;
        }

        try {
            return fs.readFileSync(filePath, 'utf-8');
        } catch (error) {
            return fallback;
        }
    }

    // --- 基础数据获取 (提前返回模式) ---

    public getRoles(): Role[] {
        return this._context.globalState.get<Role[]>(this.ROLES_KEY, []);
    }

    public getRules(): Rule[] {
        return this._context.globalState.get<Rule[]>(this.RULES_KEY, []);
    }

    public getProfiles(): Profile[] {
        return this._context.globalState.get<Profile[]>(this.PROFILES_KEY, []);
    }

    /**
     * 保存 Prompt 为 Markdown 文件到 .ykide 目录
     */
    public async savePromptAsMarkdown(content: string, firstFileName: string = 'prompt'): Promise<string> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            throw new Error('未找到工作区');
        }

        const rootPath = workspaceFolders[0].uri.fsPath;
        const ykideDir = path.join(rootPath, '.ykide');

        this._ensureDir(ykideDir);

        const safeBaseName = path.basename(firstFileName).replace(/[\\/:*?"<>|]/g, '_');
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

    private _ensureDir(dir: string): void {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    private _getPromptConfigPath(): string | undefined {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return undefined;
        }

        const rootPath = workspaceFolders[0].uri.fsPath;
        const dir = path.join(rootPath, '.ykide');
        this._ensureDir(dir);

        return path.join(dir, 'prompt-config.json');
    }

    public async savePromptConfig(data: any): Promise<void> {
        const filePath = this._getPromptConfigPath();
        if (!filePath) {
            return;
        }
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    }

    public getPromptConfig(): any {
        const filePath = this._getPromptConfigPath();
        if (!filePath || !fs.existsSync(filePath)) {
            return null;
        }

        try {
            return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        } catch {
            return null;
        }
    }

    // --- 角色/规则管理 ---

    public async saveRole(role: Role): Promise<void> {
        const data = this.getRoles();
        const index = data.findIndex(item => item.id === role.id);
        const newData = index > -1 ? data.map((it, i) => i === index ? role : it) : [...data, role];
        await this._context.globalState.update(this.ROLES_KEY, newData);
    }

    public async deleteRole(id: string): Promise<void> {
        const filtered = this.getRoles().filter(item => item.id !== id);
        await this._context.globalState.update(this.ROLES_KEY, filtered);
    }

    public async saveRule(rule: Rule): Promise<void> {
        const data = this.getRules();
        const index = data.findIndex(item => item.id === rule.id);
        const newData = index > -1 ? data.map((it, i) => i === index ? rule : it) : [...data, rule];
        await this._context.globalState.update(this.RULES_KEY, newData);
    }

    public async deleteRule(id: string): Promise<void> {
        const filtered = this.getRules().filter(item => item.id !== id);
        await this._context.globalState.update(this.RULES_KEY, filtered);
    }

    // --- 协议配置管理 (Diff/JSON/XML) ---

    public getDiffConfig(): any {
        const config = this._context.globalState.get<any>(this.DIFF_CONFIG_KEY);
        if (config && config.prompt) {
            return config;
        }

        return {
            enabled: true,
            prompt: this._getDefaultPrompt('diff-prompt.md', 'Fallback Diff Prompt')
        };
    }

    public async saveDiffConfig(config: any): Promise<void> {
        await this._context.globalState.update(this.DIFF_CONFIG_KEY, config);
    }

    public getJsonConfig(): any {
        const config = this._context.globalState.get<any>(this.JSON_CONFIG_KEY);
        if (config && config.prompt) {
            return config;
        }

        return {
            enabled: true,
            prompt: this._getDefaultPrompt('json-prompt.md', 'Fallback JSON Prompt')
        };
    }

    public async saveJsonConfig(config: any): Promise<void> {
        await this._context.globalState.update(this.JSON_CONFIG_KEY, config);
    }

    public getXmlConfig(): any {
        const config = this._context.globalState.get<any>(this.XML_CONFIG_KEY);
        if (config && config.prompt) {
            return config;
        }

        return {
            enabled: true,
            prompt: this._getDefaultPrompt('xml-prompt.md', 'Fallback XML Prompt')
        };
    }

    public async saveXmlConfig(config: any): Promise<void> {
        await this._context.globalState.update(this.XML_CONFIG_KEY, config);
    }

    // --- 重置方法 ---
    public async resetDiffConfig(): Promise<void> { await this._context.globalState.update(this.DIFF_CONFIG_KEY, undefined); }
    public async resetJsonConfig(): Promise<void> { await this._context.globalState.update(this.JSON_CONFIG_KEY, undefined); }
    public async resetXmlConfig(): Promise<void> { await this._context.globalState.update(this.XML_CONFIG_KEY, undefined); }

    // --- 规范管理 (Profiles) ---

    public async saveProfile(profile: Profile): Promise<void> {
        const data = this.getProfiles();
        const index = data.findIndex(item => item.id === profile.id);
        const newData = index > -1 ? data.map((it, i) => i === index ? profile : it) : [...data, profile];
        await this._context.globalState.update(this.PROFILES_KEY, newData);
    }

    public async deleteProfile(id: string): Promise<void> {
        const filtered = this.getProfiles().filter(item => item.id !== id);
        await this._context.globalState.update(this.PROFILES_KEY, filtered);
    }

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
            if (parsed.xmlConfig) { await this._context.globalState.update(this.XML_CONFIG_KEY, parsed.xmlConfig); }

            await this._context.globalState.update('yk-snidea.initialized', true);
        } catch (e) {
            console.error("[ConfigService] 初始化失败", e);
        }
    }

    public resolveProfileToText(profileId: string): string {
        const profile = this.getProfiles().find(p => p.id === profileId);
        if (!profile) {
            return '未绑定特定开发规范。';
        }

        const allRules = this.getRules();
        const activeRules = profile.ruleIds
            .map(id => allRules.find(r => r.id === id))
            .filter(r => !!r) as Rule[];

        if (activeRules.length === 0) { return '该规范下暂无具体规则内容。'; }

        return activeRules.map((r, i) => `${i + 1}. ${r.content}`).join('\n');
    }

    public async exportConfiguration(): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('未找到有效工作区');
            return;
        }

        const rootPath = workspaceFolders[0].uri.fsPath;
        const targetDir = path.join(rootPath, '.ykide');
        this._ensureDir(targetDir);

        const exportData = {
            version: "1.1.0",
            exportTime: new Date().toLocaleString(),
            roles: this.getRoles(),
            rules: this.getRules(),
            profiles: this.getProfiles(),
            xmlConfig: this.getXmlConfig()
        };

        const timeStr = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
        const fileName = `yk-ide_${timeStr}.json`;
        const filePath = path.join(targetDir, fileName);

        try {
            fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2), 'utf-8');
            const action = await vscode.window.showInformationMessage(`导出成功: .ykide/${fileName}`, '打开文件夹');
            if (action === '打开文件夹') {
                vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(filePath));
            }
        } catch (error: any) {
            vscode.window.showErrorMessage(`导出失败: ${error.message}`);
        }
    }
}
