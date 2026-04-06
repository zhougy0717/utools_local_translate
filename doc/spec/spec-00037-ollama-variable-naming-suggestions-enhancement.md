# Spec-00037: Ollama 变量命名建议增强与 UI 优化

## 1. 背景与目标
在当前的“变量命名”模式中，AI 仅返回一个最可能的英文短语。为了提高命名的精准度和用户体验，本方案旨在：
1.  **多候选支持**：让 AI 一次返回 3~5 个候选建议。
2.  **标签式交互**：以单行标签（Tag）形式展示候选词，用户点击即可一键刷新下方所有格式化的命名结果。
3.  **UI 专业化**：在格式化结果的标签中补全对应的英文命名规范术语（如 PascalCase, camelCase），并分行展示以提升专业感。
4.  **结构对齐**：保持“原文”区域在最底部，符合用户原有的操作习惯。

## 2. 详细设计

### 2.1 Prompt 修改 (`src/backends/ollama/prompt-manager.js`)
更新 `naming` 模板，要求模型返回多个以特定的分隔符（如 `|`）拼接的短语。

**预期输出格式**：
`phrase one | phrase two | phrase three`

### 2.2 UI 结构调整 (`src/backends/ollama/advanced-panel.html`)
1.  **新增建议区**：在 `result-label` 下方新增一个名为 `naming-suggestions-container` 的单行横向滚动容器。
2.  **格式化项标签重写**：修改 `naming-label` 的结构，从单行文本改为包含两个 `div` 的垂直布局（中文名 + 小字英文名）。
3.  **置底原文**：确保 `source-pane` 位于 `editor-main` 的底部。

### 2.3 交互逻辑实现 (`src/backends/ollama/advanced-renderer.js`)
1.  **解析结果**：
    *   在接收到 AI 返回的字符串后，使用 `result.split('|')` 进行拆分。
    *   动态创建建议标签并插入到建议区。
2.  **点击响应**：
    *   为每个建议标签绑定点击事件。
    *   点击时切换标签的 `active` 状态。
    *   同步调用 `Bridge.formatNaming(chosenPhrase)` 刷新下方的 5 个输入框内容。
3.  **自动初始化**：默认选中 AI 返回的第一个候选词。

## 3. 技术难点与考量
*   **Prompt 稳定性**：需确保 AI *只* 返回分割后的短语，不包含序号或解释文字。
*   **UI 挤压问题**：增加建议区后，需合理分配 `result-pane` 和 `source-pane` 的高度占比。

## 4. 任务拆解
1.  [ ] 修改 `prompt-manager.js` 中的命名提示词。
2.  [ ] 更新 `advanced-panel.html` 的 HTML 结构和 CSS 样式（支持 中/英文 分行展示）。
3.  [ ] 在 `advanced-renderer.js` 中实现建议词解析、标签渲染及点击联动逻辑。
4.  [ ] 进行联调测试，验证 Ollama 输出解析的健壮性。
