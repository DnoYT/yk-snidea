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
  * **State Machine Engine**: Robust line-by-line parsing that eliminates regex performance bottlenecks and tag-mismatch bugs.
  * **Sliding Window Alignment**: Professional semantic matching algorithm. Handles AI "translation hallucinations" and mixed line-endings effortlessly.
  * **60% Confidence Resilience**: Guaranteed to find and fix code locations even when AI outputs are slightly inconsistent with source files.
* **🌳 Modular Development Profiles**:
  * **Atomic Rule Pool**: Group rules by tech stack (e.g., `[vue]`, `[php]`).
  * **Smart Recommendation**: New dual-tree layout with file-suffix awareness for quick rule selection.

## 📅 Version Records

### 1.0.8 (2026-03-31)

* 🛡️ **Resilience Leap: Smart Fallback & Idempotency**:
  - **Auto-fallback to Create**: If `path` is missing during a `replace` action, the engine now automatically creates the directory structure and the file.
  - **Idempotency Shield**: Implemented a pre-check mechanism. The system intelligently skips updates if the file already reflects the `REPLACE` content, preventing corrupted re-applications.
  - **Zero-Else Architecture**: Refactored core logic to strictly follow the Early Return pattern for maximum readability and performance.

### 1.0.7 (2026-03-30)

* 💎 **Engine 5.5: Sliding Window Semantic Alignment**:
  - **Structural Reliability**: Transitioned to a State Machine parser, securing the system against code payloads containing conflicting XML markers.
  - **Semantic Intelligence**: New Sliding Window algorithm matches code based on character-tokens rather than strict strings, overcoming AI variances and formatting drift.
  - **Physical Row Splicing**: High-precision array-based updates ensure only the intended code section is modified, even in files with recurring patterns.

### 1.0.6 (2026-03-29)

* 🚀 **XML Engine & Interaction Weighting**:
  * **Weighted UI Refactor**: Enhanced the visual priority of the "Parse XML" button to reflect its role as the primary update protocol.
  * **Semantic Precision**: Renamed "Apply" actions to "Parse" to better describe the clipboard-to-workspace execution flow.
  * **Diagnostic Logging**: Added full content logging for failed `SEARCH` blocks, allowing users to instantly identify mismatch causes.
* 🛠️ **Architectural Standardization**:
  * **Full Early Return Implementation**: Refactored core services to eliminate `else` keywords and ensure strict block-level scoping.

## 🛠️ Quick Start

1. **Open**: Click the YK Snidea icon in the sidebar.
2. **Connect**: Set up your DB in the "Database" tab.
3. **Define**: Create atomic rules and combine them into "Profiles".
4. **Draft**: Use `@` for code and `#` for tables in the editor.
5. **Generate**: Click "Generate Prompt", copy to web LLM, and apply the results back via clipboard.