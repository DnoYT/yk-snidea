import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * 文件处理服务：负责工作区文件的搜索、读取与打开
 */
export class FileService {
    /**
     * 在工作区搜索文件
     * @param keyword 搜索关键词，支持路径片段如 "admin/A"
     * @returns 格式化后的文件列表
     */
    public async searchWorkspaceFiles(keyword: string) {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return [];
        }

        try {
            let searchPattern = '**/*';

            if (keyword) {
                const normalizedKeyword = keyword.replace(/\\/g, '/');
                
                if (normalizedKeyword.includes('/')) {
                    const parts = normalizedKeyword.split('/').filter(p => p.trim().length > 0);
                    
                    if (parts.length > 1) {
                        searchPattern = `**/${parts.map(p => `*${p}*`).join('/**/')}`;
                    }
                    if (parts.length === 1) {
                        searchPattern = `**/*${parts[0]}*`;
                    }
                }
                
                if (!normalizedKeyword.includes('/')) {
                    searchPattern = `**/*${keyword}*`;
                }
            }

            const excludePattern = '**/{node_modules,.git,dist,out,.vscode,obj,bin}/**';
            const uris = await vscode.workspace.findFiles(searchPattern, excludePattern, 20);

            const results = uris.map(uri => ({
                fsPath: uri.fsPath,
                relativePath: vscode.workspace.asRelativePath(uri, false),
                fileName: path.basename(uri.fsPath)
            }));

            // 将 . 开头的文件或包含 . 开头的文件夹的项排布至末尾
            results.sort((a, b) => {
                const aIsDot = a.fileName.startsWith('.') || a.relativePath.includes('/.');
                const bIsDot = b.fileName.startsWith('.') || b.relativePath.includes('/.');
                
                if (aIsDot && !bIsDot) return 1;
                if (!aIsDot && bIsDot) return -1;
                return 0;
            });

            return results;
        } catch (error) {
            console.error('[FileService] 搜索失败:', error);
            return [];
        }
    }

    /**
     * 读取指定路径的文件内容
     * @param filePath 绝对路径
     */
    public async getFileContent(filePath: string): Promise<string> {
        if (!filePath) {
            return '';
        }

        try {
            const uri = vscode.Uri.file(filePath);
            const document = await vscode.workspace.openTextDocument(uri);
            return document.getText();
        } catch (error) {
            console.error(`[FileService] 读取文件失败: ${filePath}`, error);
            return `[读取失败]: 无法访问文件 ${path.basename(filePath)}`;
        }
    }

    /**
     * 在编辑器中打开文件
     */
    public async openFile(filePath: string) {
        if (!filePath) {
            return;
        }

        try {
            const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
            await vscode.window.showTextDocument(document, { preview: false });
        } catch (error) {
            vscode.window.showErrorMessage(`无法打开文件: ${filePath}`);
        }
    }

    /**
     * 获取工作区文件树（过滤特殊文件夹，支持折叠多余文件以降低 AI 解析负担）
     * @param showAll 是否显示文件夹下的所有文件（默认 false，仅显示 1 个以代表结构）
     */
    public async getWorkspaceFileTree(showAll: boolean = false): Promise<string> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return '';
        }

        const rootPath = workspaceFolders[0].uri.fsPath;
        const treeLines: string[] = [];

        // 加载 .yktree 过滤规则
        const yktreePath = path.join(rootPath, '.ykide', '.yktree');
        let ignoreRules = ['.vscode', 'node_modules', '.git', 'dist', 'out', '.ykide', '.ide'];
        
        if (fs.existsSync(yktreePath)) {
            const content = fs.readFileSync(yktreePath, 'utf-8');
            ignoreRules = content.split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0 && !line.startsWith('#'));
        }

        const checkIgnored = (relPath: string, item: string): boolean => {
            for (const rule of ignoreRules) {
                const isExtMatch = rule.startsWith('*.') && item.endsWith(rule.substring(1));
                if (isExtMatch) return true;

                const cleanRule = rule.replace(/^\/|\/$/g, '');
                const isExactName = item === cleanRule;
                if (isExactName) return true;

                const isPathMatch = relPath === cleanRule || relPath.startsWith(`${cleanRule}/`) || relPath.includes(`/${cleanRule}/`);
                if (isPathMatch) return true;
            }
            return false;
        };

        const buildTree = (dirPath: string, prefix: string = '') => {
            let items: string[] = [];
            try {
                items = fs.readdirSync(dirPath);
            } catch (e) {
                return;
            }

            const filtered = items.filter(item => {
                const fullPath = path.join(dirPath, item);
                const relPath = path.relative(rootPath, fullPath).replace(/\\/g, '/');
                return !checkIgnored(relPath, item);
            });

            const dirs: string[] = [];
            const files: string[] = [];

            for (const item of filtered) {
                const fullPath = path.join(dirPath, item);
                try {
                    if (fs.statSync(fullPath).isDirectory()) {
                        dirs.push(item);
                    }
                    if (!fs.statSync(fullPath).isDirectory()) {
                        files.push(item);
                    }
                } catch (e) {
                }
            }

            const displayItems: string[] = [...dirs];
            
            if (showAll) {
                displayItems.push(...files);
            }
            if (!showAll && files.length > 0) {
                displayItems.push(files[0]);
                if (files.length > 1) {
                    displayItems.push(`... (省略 ${files.length - 1} 个文件)`);
                }
            }

            displayItems.forEach((item, index) => {
                const fullPath = path.join(dirPath, item);
                const isLast = index === displayItems.length - 1;
                const pointer = isLast ? '└── ' : '├── ';
                treeLines.push(`${prefix}${pointer}${item}`);

                if (dirs.includes(item)) {
                    buildTree(fullPath, prefix + (isLast ? '    ' : '│   '));
                }
            });
        };

        treeLines.push(path.basename(rootPath));
        buildTree(rootPath);
        return treeLines.join('\n');
    }

    /**
     * 预处理：清洗来自网页端的特殊不可见字符，统转为标准半角空格
     */
    private _normalizeWhitespace(str: string): string {
        if (!str) {
            return '';
        }
        return str
            .replace(/\r\n/g, '\n') // 统一换行符
            .replace(/[\u00A0\u200B\u200C\u200D\uFEFF]/g, ' ') // 替换 NBSP 及零宽字符为普通空格
            .replace(/　/g, ' '); // 替换全角空格为普通空格
    }

    /**
     * 将剪贴板中的 Diff 内容应用到工作区文件
     */
    public async applyDiffFromClipboard() {
        const rawText = await vscode.env.clipboard.readText();
        if (!rawText) {
            vscode.window.showWarningMessage('剪贴板为空');
            return;
        }

        // 统一清洗剪贴板文本中的格式化残留字符
        const text = this._normalizeWhitespace(rawText);

        const blockRegex = /文件：([^\n\r]+)[\s\S]*?<<<<<<<\s*SEARCH\n([\s\S]*?)=======\n([\s\S]*?)>>>>>>>\s*REPLACE/g;
        let match;
        let matchCount = 0;
        let successCount = 0;

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('未打开工作区，无法应用文件');
            return;
        }
        const rootPath = workspaceFolders[0].uri.fsPath;

        while ((match = blockRegex.exec(text)) !== null) {
            matchCount++;
            const relPath = match[1].trim();
            const searchContent = match[2];
            const replaceContent = match[3];

            const absPath = path.join(rootPath, relPath);
            const dirPath = path.dirname(absPath);

            // 自动创建不存在的父级目录
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
            }

            // 记录原始文件的换行符特征
            let originalContent = '';
            if (fs.existsSync(absPath)) {
                originalContent = fs.readFileSync(absPath, 'utf-8');
            }
            const isCrLf = originalContent.includes('\r\n');

            // 统一清洗文件内容与匹配块
            let fileNormalized = this._normalizeWhitespace(originalContent);
            const searchNormalized = searchContent;
            const replaceNormalized = replaceContent;

            let modified = false;

            // 策略 A：精确匹配（高效、稳定）
            if (fileNormalized.includes(searchNormalized)) {
                fileNormalized = fileNormalized.replace(searchNormalized, () => replaceNormalized);
                modified = true;
            }
            
            // 策略 B：宽容的正则模糊匹配（忽略首尾及段落间的空格扰动）
            if (!modified) {
                const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                // 将原 Search 块的首尾空白剔除，并将中间任意长的连续空白符转化为 \s* 宽容匹配
                const searchPattern = escapeRegex(searchNormalized.trim()).replace(/\s+/g, '\\s*');
                const searchRegex = new RegExp(searchPattern);

                if (searchRegex.test(fileNormalized)) {
                    // 当使用宽容匹配时，由于难以确定原始缩进边界，强制剔除两端空白并应用
                    fileNormalized = fileNormalized.replace(searchRegex, () => replaceNormalized.trim());
                    modified = true;
                }
            }

            if (modified) {
                // 恢复原始换行符并写入文件
                const finalContent = isCrLf ? fileNormalized.replace(/\n/g, '\r\n') : fileNormalized;
                fs.writeFileSync(absPath, finalContent, 'utf-8');
                successCount++;
            }
            if (!modified) {
                vscode.window.showWarningMessage(`未能匹配到 SEARCH 块 (上下差异过大): ${relPath}`);
            }
        }

        if (matchCount === 0) {
            vscode.window.showWarningMessage('剪贴板中没有解析到有效的 Diff/Replace 块');
        }
        if (matchCount !== 0) {
            vscode.window.showInformationMessage(`Diff 应用完成: 成功修改 ${successCount} 个区块，共发现 ${matchCount} 个`);
        }
    }
}