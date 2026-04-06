# Implementation Plan - 基于 Ollama 多模态模型的图片翻译

该计划旨在实现 Spec-00038 中定义的图片翻译功能。通过利用 Ollama 的 `llava` 等多模态模型，用户可以通过截图快速获取翻译结果。

## User Review Required

> [!IMPORTANT]
> **模型要求**：用户必须确保本地 Ollama 运行的是支持视觉的模型（如 `llava` 或 `qwen-vl`）。如果不满足，插件将返回错误提示。
> **DataURL 长度**：高分辨率截图会导致极大的 DataURL 字符串，可能会对内存造成压力。目前计划采用原样透传，后续视性能情况考虑压缩。

## Proposed Changes

---

### [Component] 配置与指令

#### [MODIFY] [plugin.json](file:///c:/Users/Banny/code/local_translate/plugin.json)
- 在 `dict` 特性的 `cmds` 中增加 `{ "type": "img", "label": "图片翻译" }`。

---

### [Component] 提示词与核心逻辑

#### [MODIFY] [prompt-manager.js](file:///c:/Users/Banny/code/local_translate/src/backends/ollama/prompt-manager.js)
- 新增 `vision` 模板，用于指导模型进行 OCR 提取和翻译。

#### [MODIFY] [backend_manager.js](file:///c:/Users/Banny/code/local_translate/src/core/backend_manager.js)
- 新增 `queryImage(imageData, callback, progressCallback)` 方法。
- 实现路由分发逻辑：仅在后端支持 `queryImage` 时调用，否则提示不支持。

#### [MODIFY] [src/backends/ollama/index.js](file:///c:/Users/Banny/code/local_translate/src/backends/ollama/index.js)
- 实现 `queryImage` 方法。
- 构造支持 `content` 数组的 `messages` 结构发送至 Ollama。

---

### [Component] 触发与入口

#### [MODIFY] [preload.js](file:///c:/Users/Banny/code/local_translate/preload.js)
- 在 `enter` 回调中匹配 `action.type === 'img'`。
- 从 `action.payload` 提取图片并分发至 `BackendManager`。
- 实现异步加载状态展示。

---

### [Component] 自动化测试

#### [NEW] [ollama_backend.test.js](file:///c:/Users/Banny/code/local_translate/test/ollama_backend.test.js)
- 验证 `queryImage` 生成的 Payload 是否符合 OpenAI 视觉模型标准。
- 测试模型报错时的处理逻辑。

#### [NEW] [prompt_manager.test.js](file:///c:/Users/Banny/code/local_translate/test/prompt_manager.test.js)
- 验证 `vision` 模板的加载和变量替换。

## Verification Plan

### Automated Tests
- 运行 `npm test` 命令执行新编写的单元测试。
- 使用 `jest` 模拟 Ollama API 响应。

### Manual Verification
1. 复制一张包含文字的图片到剪贴板。
2. 打开 uTools 搜索框，选择“图片翻译”建议项。
3. 观察列表是否显示“正在识别图片...”。
4. 验证是否返回了正确的提取与翻译文本。
5. 切换到不支持视觉的后端（如本地词典），验证是否提示“不支持图片识别”。
