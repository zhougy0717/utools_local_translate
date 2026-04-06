# Implementation Plan - Ollama 进阶翻译中心

## 1. 目标
在所有翻译模式中加入 Ollama 进阶翻译入口，并实现一个功能完整、可编辑的翻译工作台面板。

## 2. 提议的变更

### 2.1 核心服务层 (Core Services)

#### [NEW] [prompt-manager.js](file:///c:/Users/Banny/code/local_translate/src/backends/ollama/prompt-manager.js)
*   **职责**: 管理不同 AI 任务的提示词模板。
*   **功能**:
    *   提供默认的“进阶翻译”中文模板。
    *   支持变量替换（`[TARGET_LANG]`, `[TEXT]`）。

#### [NEW] [advanced-service.js](file:///c:/Users/Banny/code/local_translate/src/backends/ollama/advanced-service.js)
*   **职责**: 管理进阶面板的 Webview 生命周期，并作为 IPC 桥梁。
*   **功能**:
    *   `openPanel(initialText)`: 挂载 iframe，分配 `window._advancedAPI`。
    *   `closePanel()`: 卸载容器，恢复 uTools 高度。
    *   通过 Bridge 提供常用的 `query`、`getModels` 等接口。

### 2.2 界面与渲染层 (UI & Rendering)

#### [NEW] [advanced-panel.html](file:///c:/Users/Banny/code/local_translate/src/backends/ollama/advanced-panel.html)
*   **职责**: 进阶面板的 HTML 结构与 CSS。
*   **设计**: 遵循 Spec 中的**白色主题**和**三段式布局**。

#### [NEW] [advanced-renderer.js](file:///c:/Users/Banny/code/local_translate/src/backends/ollama/advanced-renderer.js)
*   **职责**: 控制面板交互。
*   **逻辑**:
    *   初始加载时更新“原文”和“提示词”框。
    *   监听“执行翻译”按钮，调用 Bridge 接口请求 Ollama。
    *   处理渲染翻译结果（支持 Markdown）。

### 2.3 集成逻辑 (Integration)

#### [MODIFY] [view_presenter.js](file:///c:/Users/Banny/code/local_translate/src/utils/view_presenter.js)
*   在 `buildResultItems` 函数末尾，检测 Ollama 是否可用，并追加 `✨ 使用 Ollama 进阶翻译...` 项。
*   为该项设置特殊的 `isAdvancedOllama: true` 标记。

#### [MODIFY] [backend_manager.js](file:///c:/Users/Banny/code/local_translate/src/core/backend_manager.js)
*   新增 `openAdvancedPanel(text)` 方法，协调 `AdvancedPanelService` 的启动。

#### [MODIFY] [preload.js](file:///c:/Users/Banny/code/local_translate/preload.js)
*   在 `select` 回调中，识别 `isAdvancedOllama` 标记，并调用 `BackendManager.openAdvancedPanel`。

## 3. 验证计划

### 3.1 自动化测试
*   编写 `test/prompt_manager.test.js`：
    *   测试模板变量替换是否正确。
    *   测试空文本处理。

### 3.2 手动验证步骤
1.  **词典模式进入**: 查询一个单词，滚动到列表底部，验证进阶入口是否存在。
2.  **面板初始化**: 点击入口，验证面板是否正常弹出，且原文已正确填充。
3.  **编辑与执行**: 
    *   在面板中修改原文。
    *   点击“执行翻译”，验证 Ollama 是否返回了针对修改后原文的翻译。
4.  **UI 风格**: 验证面板是否为白色背景，风格是否与插件统一。

## 4. 待解决问题
*   **流式输出**: 目前 `OllamaBackend` 主要支持非流式，进阶面板是否需要立即支持流式（Stream）以提升体验？(建议首期保持非流式以确保稳定性，后期优化)。
