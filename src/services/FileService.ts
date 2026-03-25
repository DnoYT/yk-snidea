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

        const buildTree = (dirPath: string, prefix: string = '') => {
            let items: string[] = [];
            try {
                items = fs.readdirSync(dirPath);
            } catch (e) {
                return;
            }

            const filtered = items.filter(item => {
                return !['.vscode', 'node_modules', '.git', 'dist', 'out', '.ykide', '.ide'].includes(item);
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
     * 将剪贴板中的 Diff 内容应用到工作区文件
     */
    public async applyDiffFromClipboard() {
        const text = await vscode.env.clipboard.readText();
        if (!text) {
            vscode.window.showWarningMessage('剪贴板为空');
            return;
        }

        const blockRegex = /文件：([^\n\r]+)[\s\S]*?<<<<<<<\s*SEARCH\r?\n([\s\S]*?)=======\r?\n([\s\S]*?)>>>>>>>\s*REPLACE/g;
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

            // 初始化内容：若文件不存在则视为空字符串，以支持“新建文件”
            let fileContent = '';
            if (fs.existsSync(absPath)) {
                fileContent = fs.readFileSync(absPath, 'utf-8');
            }
            const isCrLf = fileContent.includes('\r\n'); 

            let fileNormalized = fileContent.replace(/\r\n/g, '\n');
            const searchNormalized = searchContent.replace(/\r\n/g, '\n');
            const replaceNormalized = replaceContent.replace(/\r\n/g, '\n');

            let modified = false;

            if (fileNormalized.includes(searchNormalized)) {
                fileNormalized = fileNormalized.replace(searchNormalized, () => replaceNormalized);
                modified = true;
            }
            if (!fileNormalized.includes(searchNormalized)) {
                const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const searchPattern = escapeRegex(searchNormalized.trim()).replace(/\s+/g, '\\s+');
                const searchRegex = new RegExp(searchPattern);

                if (searchRegex.test(fileNormalized)) {
                    fileNormalized = fileNormalized.replace(searchRegex, () => replaceNormalized.trim());
                    modified = true;
                }
            }

            if (modified) {
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