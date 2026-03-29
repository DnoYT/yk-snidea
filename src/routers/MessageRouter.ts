import * as vscode from "vscode";
import { FileService } from "../services/FileService";
import { PromptService } from "../services/PromptService";
import { ConfigService } from "../services/ConfigService";
import { DatabaseService, DbConfig } from "../services/DatabaseService";
import { DiffService } from "../services/DiffService";
import { JsonService } from "../services/JsonService";
import { XmlService } from "../services/XmlService";
import * as path from "path";
import * as fs from "fs";

export class MessageRouter {
    private readonly _diffService: DiffService;
    private readonly _jsonService: JsonService;
    private readonly _xmlService: XmlService;

    constructor(
        private readonly _fileService: FileService,
        private readonly _promptService: PromptService,
        private readonly _configService: ConfigService,
        private readonly _dbService: DatabaseService,
        private readonly _context: vscode.ExtensionContext,
    ) {
        this._diffService = new DiffService();
        this._jsonService = new JsonService();
        this._xmlService = new XmlService();
    }

    /**
     * 将最新的角色、规则及 Diff/JSON 配置同步至 Webview 端
     */
    private _refreshSettings(webviewView: vscode.WebviewView) {
        const diffConfig = this._configService.getDiffConfig();
        const jsonConfig = this._configService.getJsonConfig();

        webviewView.webview.postMessage({
          type: "settingsData",
          roles: this._configService.getRoles(),
          rules: this._configService.getRules(),
          profiles: this._configService.getProfiles(),
          diffConfig: diffConfig,
          jsonConfig: jsonConfig,
          xmlConfig: this._configService.getXmlConfig(),
      });
    }

    /**
     * 保存数据库配置并执行连接测试，反馈给 Webview
     */
    private async _handleDbSave(
        webviewView: vscode.WebviewView,
        config: DbConfig,
    ) {
        try {
            await this._dbService.saveConfig(config);
            const tables = await this._dbService.testAndGetTables(config);
            webviewView.webview.postMessage({
                type: "dbStatus",
                success: true,
                tables,
            });
        } catch (err: any) {
            webviewView.webview.postMessage({
                type: "dbStatus",
                success: false,
                error: err.message,
            });
        }
    }

    /**
     * 搜索数据库表，反馈结果给 Webview 的 Mention 列表
     */
    private async _handleTableSearch(
        webviewView: vscode.WebviewView,
        keyword: string,
    ) {
        const config = this._dbService.getConfig();
        if (!config) {
            webviewView.webview.postMessage({ type: "tableResults", tables: [] });
            return;
        }

        try {
            const allTables = await this._dbService.testAndGetTables(config);
          const filtered = allTables.filter((t) => t.includes(keyword || ""));
          webviewView.webview.postMessage({
              type: "tableResults",
              tables: filtered,
          });
      } catch (err) {
            webviewView.webview.postMessage({ type: "tableResults", tables: [] });
        }
    }

  /**
   * 主消息分发中心：路由所有从 Webview UI 发送过来的指令
   */
    public async handleMessage(webviewView: vscode.WebviewView, message: any) {
        console.log(`[MessageRouter] 路由指令: ${message.type}`);

        switch (message.type) {
        // ================= 1. 全局配置与系统设置 =================

          // 导出插件所有配置到工作区 .ykide 文件夹
          case "exportSettings":
              await this._configService.exportConfiguration();
              return;

          // 从本地 JSON 文件导入配置（角色、规则、规范）
          case "importSettings": {
              const uris = await vscode.window.showOpenDialog({
                  canSelectMany: false,
                filters: { "JSON Files": ["json"] },
                openLabel: "导入配置",
            });

              if (!uris || uris.length === 0) { return; }

              try {
                const content = fs.readFileSync(uris[0].fsPath, "utf-8");
                const parsed = JSON.parse(content);

                // 批量保存配置项
                if (Array.isArray(parsed.roles)) {
                    for (const r of parsed.roles) {
                        await this._configService.saveRole(r);
                    }
            }
                if (Array.isArray(parsed.rules)) {
                    for (const r of parsed.rules) {
                        await this._configService.saveRule(r);
                    }
                }
                if (Array.isArray(parsed.profiles)) {
                    for (const p of parsed.profiles) {
                        await this._configService.saveProfile(p);
                    }
                }

                vscode.window.showInformationMessage("配置导入成功！");
                this._refreshSettings(webviewView);
            } catch (err: any) {
                  vscode.window.showErrorMessage(`导入失败: ${err.message}`);
              }
              return;
          }

          // 获取当前所有设置数据
          case "getSettings":
              this._refreshSettings(webviewView);
              return;

          // ================= 2. Prompt 配置与生成 =================

          // 加载主表单（需求/角色/规则选择）的上次配置缓存
          case "getPromptConfig": {
              const config = this._configService.getPromptConfig();
              webviewView.webview.postMessage({
                type: "promptConfigData",
                data: config,
            });
              return;
          }

          // 仅保存当前主表单的 UI 状态配置
          case "savePromptConfig":
              await this._configService.savePromptConfig(message.data);
              return;

          // 执行 Prompt 生成逻辑（拼装文件树、代码、DDL、角色与规则）
          case "generate": {
              await this._configService.savePromptConfig(message.data);
              const prompt = await this._promptService.build(
                  message.data,
                  this._context,
              );
              webviewView.webview.postMessage({
                type: "renderResult",
                value: prompt,
            });
              return;
          }

          // 将生成的 Prompt 结果保存为工作区的 Markdown 文件
          case "savePromptFile": {
              try {
                  const fileNameHint =
                      message.files && message.files.length > 0
                          ? message.files[0]
                          : "prompt";
                  const savedPath = await this._configService.savePromptAsMarkdown(
                      message.value,
                      fileNameHint,
                  );
                  vscode.window.showInformationMessage(
                      `保存成功: .ykide/${path.basename(savedPath)}`,
                  );
              } catch (err: any) {
                  vscode.window.showErrorMessage(`保存失败: ${err.message}`);
              }
              return;
          }

          // ================= 3. 文件处理与代码交互 =================

          // 从剪贴板读取 Diff 格式代码并应用到本地文件
          case "applyDiffFromClipboard":
              await this._diffService.applyDiffFromClipboard();
              return;

          // 从剪贴板读取 JSON 格式代码更新并应用
          case "applyJsonFromClipboard":
              await this._jsonService.applyJsonFromClipboard();
              return;

          // 从剪贴板读取 XML 格式代码更新并应用
          case "applyXmlFromClipboard":
              await this._xmlService.applyXmlFromClipboard();
              return;

          // 文本复制通用指令
          case "copyToClipboard":
              await vscode.env.clipboard.writeText(message.value);
              vscode.window.showInformationMessage("已复制到剪贴板");
              return;

          // 编辑器提及功能 (@指令) 的文件搜索回调
          case "searchFiles": {
              const files = await this._fileService.searchWorkspaceFiles(
                  message.keyword,
              );
              webviewView.webview.postMessage({ type: "searchResults", files });
              return;
          }

          // 双击已生成的 Mention 标签打开对应本地文件
          case "openFile":
              await this._fileService.openFile(message.path);
              return;

          // ================= 4. 角色/规则/规范的增删改 =================
          case "saveRole":
              await this._configService.saveRole(message.data);
              this._refreshSettings(webviewView);
              return;

          case "deleteRole":
              await this._configService.deleteRole(message.roleId);
              this._refreshSettings(webviewView);
              return;

          case "saveRule":
              await this._configService.saveRule(message.data);
              this._refreshSettings(webviewView);
              return;

          case "deleteRule":
              await this._configService.deleteRule(message.ruleId);
              this._refreshSettings(webviewView);
              return;

          case "saveProfile":
              await this._configService.saveProfile(message.data);
              this._refreshSettings(webviewView);
              return;

          case "deleteProfile":
              await this._configService.deleteProfile(message.profileId);
              this._refreshSettings(webviewView);
              return;

          case "saveDiffConfig":
              await this._configService.saveDiffConfig(message.data);
              this._refreshSettings(webviewView);
              vscode.window.showInformationMessage("Diff 配置已保存");
              return;

          case "saveJsonConfig":
              await this._configService.saveJsonConfig(message.data);
              this._refreshSettings(webviewView);
              vscode.window.showInformationMessage("JSON 配置已保存");
              return;

          case "saveXmlConfig":
              await this._configService.saveXmlConfig(message.data);
              this._refreshSettings(webviewView);
              vscode.window.showInformationMessage("XML 配置已保存");
              return;

          case "resetDiffConfig":
              await this._configService.resetDiffConfig();
              this._refreshSettings(webviewView);
              vscode.window.showInformationMessage("Diff 配置已重置为默认");
              return;

          case "resetJsonConfig":
              await this._configService.resetJsonConfig();
              this._refreshSettings(webviewView);
              vscode.window.showInformationMessage("JSON 配置已重置为默认");
              return;

          case "resetXmlConfig":
              await this._configService.resetXmlConfig();
              this._refreshSettings(webviewView);
              vscode.window.showInformationMessage("XML 配置已重置为默认");
              return;

          // ================= 5. 数据库交互模块 =================
          case "saveDbConfig":
              await this._handleDbSave(webviewView, message.data);
              return;

          case "searchTables":
              await this._handleTableSearch(webviewView, message.keyword);
              return;

          case "getDbConfig":
              const dbConfig = this._dbService.getConfig();
              webviewView.webview.postMessage({
                type: "dbConfigData",
                config: dbConfig || null,
            });
              return;

          // ================= 6. 前端工具与交互反馈 =================
          case "log":
              console.log(`[前端日志 | ${message.tag}]`, message.data);
              return;

          case "info":
              vscode.window.showInformationMessage(message.value);
              return;

            case "error":
                vscode.window.showErrorMessage(message.value);
                return;

            default:
                console.log("[MessageRouter] 忽略未知请求类型:", message.type);
                return;
        }
    }
}
