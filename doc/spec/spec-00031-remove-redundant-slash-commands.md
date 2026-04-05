# Spec-00031: 清理冗余的斜线命令 (Ollama 与 Path)

## 1. 背景与动机
随着项目逐步将配置功能从基于文字输入的「斜线命令」迁移至「图形化 UI 面板」，原有的部分命令已成为冗余。
`/ollama` 命令提供的 API 配置、模型选择功能已完全由 `src/backends/ollama/ollama-prompt-config.html` 接管。
`/path` 命令提供的离线词典存储路径配置已整合进 `src/backends/dict/dict-config.html` 的 UI 界面中。
为了保持代码整洁、减少包体积并降低维护成本，需要彻底移除这两个过时的命令模块。

## 2. 目标
*   从项目中彻底删除 `/ollama` 和 `/path` 两个斜线命令。
*   保留 `/mode`（翻译模式切换）和 `/libre`（离线包管理，暂留）命令。
*   确保配置功能在 UI 界面中完全闭环，不依赖已删除的命令。

## 3. 详细设计

### 3.1 核心代码变更
1.  **文件删除**：
    *   `src/commands/ollama.js`: 包含所有 Ollama 相关的旧版命令逻辑。
    *   `src/commands/path.js`: 包含旧版存储路径配置逻辑。

2.  **命令注册更新 (`src/commands/index.js`)**：
    *   移除对 `ollamaCommand` 和 `pathCommand` 的引入。
    *   从 `COMMANDS` 导出数组中删除这两个项。

3.  **`preload.js` 冗余清理**：
    *   移除初始化 `backendConfig` 时显式传递的空路径/配置项（如 `ollama: {}`, `libretranslate: {}`），简化传参。
    *   因为目前的后端（Backend）逻辑已改为自主利用 `ConfigManager` 进行按需加载，无需在此处传递空的 placeholder 对象。

### 3.2 功能存续验证
*   **存储路径 (`resourcePath`)**：验证 `src/backends/dict/dict-renderer.js` 及其对应的 HTML 已正确处理 `btnBrowse` 的点击事件，能够独立完成存储目录的设置。
*   **Ollama 配置**：验证从翻译界面或插件设置进入的 Ollama 配置面板能够完成地址、密钥、模型及提示词的完整设置。

## 4. 破坏性变更 (Breaking Changes)
*   用户在搜索框中输入 `/ollama` 或 `/path` 将不再出现任何命令提示或处理逻辑。
*   原有基于命令行的配置方式将被全 UI 交互取代。

## 5. 验收标准
*   [ ] `/ollama` 和 `/path` 文件已从 `src/commands` 目录中物理删除。
*   [ ] `src/commands/index.js` 中不再包含这两个模块的任何引用。
*   [ ] 翻译模式切换 (`/mode`) 功能仍能正常运作。
*   [ ] 通过 UI 面板（词典配置和 Ollama 配置）设置的值能正确持久化到 `utools.dbStorage` 中。
