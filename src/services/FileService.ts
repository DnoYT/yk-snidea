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
                const cleanKeyword = keyword.replace(/\\/g, '/');
                const parts = cleanKeyword.split('/').filter(p => p.trim().length > 0);
                
                if (parts.length > 0) {
                    // 构造基础 glob 片段，如 comp -> **/*comp*
                    const basePattern = `**/${parts.map(p => `*${p}*`).join('/**/')}`;
                    // 使用 {} 集合同时匹配文件本身和以此为路径前缀的子文件
                    // 这使得输入文件夹名称片段也能检索出其内部文件
                    searchPattern = `{${basePattern},${basePattern}/**}`;
                }
            }

            const excludePattern = '**/{node_modules,.git,dist,out,.vscode,obj,bin}/**';
            const uris = await vscode.workspace.findFiles(searchPattern, excludePattern, 20);

            const results = uris.map(uri => ({
                fsPath: uri.fsPath,
                relativePath: vscode.workspace.asRelativePath(uri, false),
                fileName: path.basename(uri.fsPath)
            }));

            // 将 . 或 _ 开头的文件，或包含此类文件夹的项排布至末尾
            results.sort((a, b) => {
                const aIsSpecial = a.fileName.startsWith('.') || a.fileName.startsWith('_') || a.relativePath.includes('/.') || a.relativePath.includes('/_');
                const bIsSpecial = b.fileName.startsWith('.') || b.fileName.startsWith('_') || b.relativePath.includes('/.') || b.relativePath.includes('/_');
                
                if (aIsSpecial && !bIsSpecial) {
                    return 1;
                }
                if (!aIsSpecial && bIsSpecial) {
                    return -1;
                }
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
                if (isExtMatch) { return true; }

                const cleanRule = rule.replace(/^\/|\/$/g, '');
                const isExactName = item === cleanRule;
                if (isExactName) { return true; }

                const isPathMatch = relPath === cleanRule || relPath.startsWith(`${cleanRule}/`) || relPath.includes(`/${cleanRule}/`);
                if (isPathMatch) { return true; }
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

}