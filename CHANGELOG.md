# Changelog

All notable changes to the "yk-snidea" extension will be documented in this file.

## [1.0.6] - 2026-03-29
### Added
- Enhanced logging for `XmlService`: Logs full `SEARCH` block content on match failure for easier debugging.
- Visual highlighting for the XML parsing button in the main form.
### Changed
- Renamed "Apply" buttons to "Parse" across the Webview UI.
- Refactored `XmlService` and `ConfigService` to strictly follow Early Return (no-else) patterns.
- Optimized button rendering logic using `v-for` for better maintainability.
### Fixed
- ESLint `curly` warnings across multiple service files.

## [1.0.5] - 2026-03-28
### Added
- Dual-column rule tree layout with "Smart Recommendation" and "Full Library".
- Suffix-aware rule filtering based on editor content (.vue, .php, etc.).
- "Reset Configuration" button for Diff/JSON prompt settings.
- Relative path display for `@` file mentions.
### Changed
- Optimized file search sorting to deprioritize hidden files (starting with `.` or `_`).
- Enhanced rule tree nodes with word-wrap support and Iconify integration.

## [1.0.4] - 2026-03-28
### Added
- JSON structured parsing support for code replacement.
- Decoupled `DiffService` and `JsonService` for better architecture.
- Dynamic system prompts based on preferred output format.

## [1.0.3] - 2026-03-26
### Added
- Automated SEARCH/REPLACE block application.
- Intelligent file and directory creation.
- File tree (yktree) generation system.
- Configuration import/export functionality.