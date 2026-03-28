# YK Snidea - AI Developer's Companion for Web-based LLMs

**YK Snidea** is a VS Code extension developed by **Guangxi Yunke Interactive Technology Co., Ltd.** It solves a key pain point: how to leverage top-tier LLMs efficiently and at low cost without expensive API tokens or regional network restrictions.

By precisely extracting local code and database context, it assembles high-quality Prompts for you to use directly in web-interfaces (ChatGPT, Claude, DeepSeek), providing an AI IDE experience for free.

## ✨ Key Features

* **🎭 Visual Role Management**: Manage system prompts with live previews.
* **🔗 Deep Context Linking**:
  * **Use `@`**: Search and read source code with relative path awareness.
  * **Use `#`**: Retrieve MySQL table schemas with DDL hover previews.
  * **🌳 Structure Awareness**: Generate project file trees with custom ignore rules.
* **🚀 Automated Code Application (Diff/Replace)**:
  * **Smart Parsing**: Supports `SEARCH/REPLACE` blocks and JSON structured updates.
  * **Seamless Apply**: Apply changes from clipboard with directory auto-creation.
* **🌳 Modular Development Profiles**:
  * **Atomic Rule Pool**: Group rules by tech stack (e.g., `[vue]`, `[php]`).
  * **Smart Recommendation**: New dual-tree layout with file-suffix awareness for quick rule selection.

## 🛠️ Quick Start

1. **Open**: Click the YK Snidea icon in the sidebar.
2. **Connect**: Set up your DB in the "Database" tab.
3. **Define**: Create atomic rules and combine them into "Profiles".
4. **Draft**: Use `@` for code and `#` for tables in the editor.
5. **Generate**: Click "Generate Prompt", copy to web LLM, and apply the results back via clipboard.