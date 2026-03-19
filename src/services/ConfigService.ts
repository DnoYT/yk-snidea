import * as vscode from 'vscode';

/**
 * 原子规则：例如“不使用else”
 */
export interface Rule {
    id: string;
    name: string;
    content: string;
}

/**
 * 规范配置：例如“Uniapp规范”，绑定了多个 Rule ID
 */
export interface Profile {
    id: string;
    name: string;
    ruleIds: string[];
}

export class ConfigService {
    private readonly RULES_KEY = 'yk-snidea.rules';
    private readonly PROFILES_KEY = 'yk-snidea.profiles';

    constructor(private readonly _context: vscode.ExtensionContext) { }

    // --- 规则管理 (Rules) ---

    /**
     * 获取所有规则
     */
    public getRules(): Rule[] {
        return this._context.globalState.get<Rule[]>(this.RULES_KEY, []);
    }

    /**
     * 保存或更新规则
     */
    public async saveRule(rule: Rule): Promise<void> {
        const rules = this.getRules();
        const index = rules.findIndex(r => r.id === rule.id);

        if (index > -1) {
            rules[index] = rule;
            await this._context.globalState.update(this.RULES_KEY, [...rules]);
            return;
        }

        rules.push(rule);
        await this._context.globalState.update(this.RULES_KEY, [...rules]);
    }

    /**
     * 删除规则
     */
    public async deleteRule(ruleId: string): Promise<void> {
        const rules = this.getRules().filter(r => r.id !== ruleId);
        await this._context.globalState.update(this.RULES_KEY, rules);
    }

    // --- 规范管理 (Profiles) ---

    /**
     * 获取所有规范
     */
    public getProfiles(): Profile[] {
        return this._context.globalState.get<Profile[]>(this.PROFILES_KEY, []);
    }

    /**
     * 保存或更新规范
     */
    public async saveProfile(profile: Profile): Promise<void> {
        const profiles = this.getProfiles();
        const index = profiles.findIndex(p => p.id === profile.id);

        if (index > -1) {
            profiles[index] = profile;
            await this._context.globalState.update(this.PROFILES_KEY, [...profiles]);
            return;
        }

        profiles.push(profile);
        await this._context.globalState.update(this.PROFILES_KEY, [...profiles]);
    }

    // --- 核心逻辑：解析规范 ---

    /**
     * 根据规范 ID 获取最终合并后的提示词文本
     * @param profileId 规范 ID
     */
    public resolveProfileToText(profileId: string): string {
        const profiles = this.getProfiles();
        const profile = profiles.find(p => p.id === profileId);

        if (!profile) return '未找到匹配的开发规范';

        const allRules = this.getRules();
        // 找到该 Profile 绑定的所有 Rule 并提取 content
        const activeRules = profile.ruleIds
            .map(id => allRules.find(r => r.id === id))
            .filter(r => !!r) as Rule[];

        if (activeRules.length === 0) return '该规范下未绑定任何具体规则';

        // 拼接成带序号的列表
        return activeRules.map((r, i) => `${i + 1}. ${r.content}`).join('\n');
    }
}