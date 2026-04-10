# Spec-00040: 文本与图片翻译独立模型选择设计

## 1. 背景 (Background)

当前插件的 Ollama/OpenAI 后端仅支持配置一个全局模型（`model`）。随着多模态大模型的普及，用户通常会使用纯文本模型进行快速翻译，而使用专门的 Vision 模型（如 `minicpm-v`, `llava`, `qwen-vl` 等）进行图片翻译。

目前用户在频繁切换文本和图片翻译时，必须手动在顶栏不断切换模型，这极大影响了使用效率。

## 2. 目标 (Objective)

为文本翻译和图片翻译设置独立的模型选择记忆，实现“一次配置，按需自动切换”：
- **独立存储**：在配置文件中分别保存 `model` (文本) 和 `visionModel` (图片)。
- **一站式配置**：在 Ollama 深度配置页面提供两个并列的选择框。
- **智能感应切换**：进阶翻译中心根据活跃页签自动加载对应的模型，并允许即时修改及保存。

## 3. 架构设计 (Architecture)

### 3.1 数据架构 (Data Schema)

修改 `src/backends/ollama/config.js` 中的 `OLLAMA_DEFAULTS`：
```javascript
const OLLAMA_DEFAULTS = {
  // ... 其他配置
  model: '',          // 主模型 (文本用)
  visionModel: '',    // 识图模型 (图片用)
  // ... 其他配置
};
```

### 3.2 UI 交互设计 (UI/UX)

#### 3.2.1 Ollama 深度配置页 (`ollama-prompt-config.html`)
- **布局调整**：将原有的“模型名称”行修改为包含两个 `select` 控件的栅格或 Flex 布局。
- **视觉标签**：
    - 文本翻译模型 (Text Model)
    - 图片翻译模型 (Vision Model)

#### 3.2.2 进阶翻译中心 (`advanced-panel.html`)
- **动感标签**：为顶部工具栏的模型选择文字添加 ID (`#model-select-label`)，以便动态修改。
- **状态同步**：
    - 当任务页签切换至 `ocr` 时：
        - 设置 `#model-select-label` 为 “图片翻译模型:”。
        - 设置 `#model-select` 的值为当前配置的 `visionModel`。
    - 当任务页签切换至 `advanced` 或 `naming` 时：
        - 设置 `#model-select-label` 为 “使用模型:”。
        - 设置 `#model-select` 的值为当前配置的 `model`。

### 3.3 逻辑流 (Logic Flow)

1. **模型加载**：`advanced-renderer.js` 在 `init` 和 `switchTask` 时，读取完整的 config。
2. **即时保存**：
    - 用户在进阶面板通过顶部下拉框修改模型时，前端实时调用 `Bridge.saveConfig`。
    - 保存逻辑：`if (currentTask === 'ocr') { config.visionModel = newValue; } else { config.model = newValue; }`。
3. **翻译执行**：
    - `handleTask` 在执行 OCR 任务时，从配置中读取 `visionModel` 启动 Vision 流程。

## 4. 实施计划 (Implementation Plan)

- **Phase 1**: 修改 `config.js` 扩展配置项。
- **Phase 2**: 修改 `ollama-prompt-config.html` 和 `ollama-renderer.js` 实现配置页双选功能。
- **Phase 3**: 修改 `advanced-panel.html` 和 `advanced-renderer.js` 实现进阶面板的动态感知和独立保存。
- **Phase 4**: 验证不同场景下的模型切换一致性。

## 5. 兼容性 (Compatibility)

- **存量数据**：旧版插件升级后，`visionModel` 默认为空，当用户首次进行图片翻译并选择模型后自动补全。
## 6. 测试设计 (Testing Design)

### 6.1 单元测试 (Unit Tests)

针对核心配置逻辑和渲染状态切换进行验证：

- **配置初始化测试 (`OllamaConfig`)**:
    - 验证 `OLLAMA_DEFAULTS` 是否正确包含 `visionModel` 及其初始值。
- **配置持久化测试 (`OllamaRenderer`)**:
    - 模拟文本模型选择框变更，验证 `saveConfig` 仅更新 `model` 字段。
    - 模拟图片模型选择框变更，验证 `saveConfig` 仅更新 `visionModel` 字段。
- **任务切换响应测试 (`AdvancedRenderer`)**:
    - 模拟调用 `switchTask('ocr')`，验证 `UI.modelSelectLabel` 文本更新为“图片翻译模型:”，且 `UI.modelSelect.value` 同步为 `visionModel`。
    - 模拟调用 `switchTask('advanced')`，验证标签恢复为“使用模型:”，且值为 `model`。
- **任务执行参数测试 (`AdvancedRenderer`)**:
    - 在 `ocr` 模式下触发 `handleTask`，验证传递给后端 API 的 `model` 参数为配置中的 `visionModel`。

### 6.2 手动验证流程 (Manual Testing)

1.  **全局配置验证**：
    - 进入 Ollama 深度配置页，为文本和图片分别选择不同的模型。
    - 点击保存后重新打开，确认两个模型选择均正确记忆。
2.  **即时联动验证**：
    - 打开进阶翻译中心，在“进阶翻译”下修改模型。
    - 切换到“图片翻译”页签，确认模型已自动变为预设的图片模型。
    - 在图片翻译下修改模型并执行。
    - 切换回“进阶翻译”，确认模型恢复为之前选定的文本模型。
3.  **翻译隔离验证**：
    - 图片翻译执行成功后，返回普通翻译窗口，确认普通翻译依然使用对应的文本模型。
