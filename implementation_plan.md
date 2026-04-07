# 实施计划 - 图片翻译与视觉识别增强

基于 `spec-00038` 设计规约，在进阶翻译中心增加图片翻译页签，并支持 uTools 列表视图下的快速识别结果展示。

## 1. 核心架构调整

### 1.1 指令与入口
#### [MODIFY] [plugin.json](file:///Users/guangyu/Projects/utools/utools_local_translate/plugin.json)
- 在 `dict` 特性的 `cmds` 中增加 `{"type": "img", "label": "图片翻译"}`，允许 uTools 识别剪贴板图片并建议打开本插件。

#### [MODIFY] [preload.js](file:///Users/guangyu/Projects/utools/utools_local_translate/preload.js)
- 增强 `enter` 钩子对 `img` 负载的处理。
- **重点实现**：在发送给后端前，利用 `Canvas` 进行图片预处理（长边限制 1024px，JPEG 0.8 压缩），解决负载超限问题。

### 1.2 后端调度与逻辑
#### [MODIFY] [src/core/backend_manager.js](file:///Users/guangyu/Projects/utools/utools_local_translate/src/core/backend_manager.js)
- 完善 `queryImage` 方法：固化其直接分发至专用的 `OllamaBackend` 实例，不依赖全局 `activeBackend`。
- 将识别与能力预检接口暴露给 `AdvancedPanelService` 的桥接 API。

#### [MODIFY] [src/backends/ollama/index.js](file:///Users/guangyu/Projects/utools/utools_local_translate/src/backends/ollama/index.js)
- 实现 `checkVisionCapability`：请求 `/api/show` 确认模型包含 `projector` 类型。
- 升级 `queryImage`：解析 AI 返回的结构化文本（提取源码与译文）。

#### [MODIFY] [src/backends/ollama/prompt-manager.js](file:///Users/guangyu/Projects/utools/utools_local_translate/src/backends/ollama/prompt-manager.js)
- 调优 `vision` 提示词模板，确保输出符合 `SOURCE:` 和 `TARGET:` 的结构。

---

## 2. UI 展现层实现

### 2.1 快速列表视图 (uTools List)
#### [MODIFY] [src/utils/view_presenter.js](file:///Users/guangyu/Projects/utools/utools_local_translate/src/utils/view_presenter.js)
- 更新 `buildResultItems`：若输入包含识别出的原文，则将其作为独立的列表项（带复制功能）展示，方便快速核对。

### 2.2 进阶中心 UI (Advanced Center)
#### [MODIFY] [src/backends/ollama/advanced-panel.html](file:///Users/guangyu/Projects/utools/utools_local_translate/src/backends/ollama/advanced-panel.html)
- 侧边栏增加 `nav-item`。
- 增加 `ocr-layout` 容器：
    - `Top`: 翻译结果展示（只读）。
    - `Middle`: OCR 识别结果（Textarea，可编辑）。
    - `Bottom`: 原图参考（Img 预览）。

#### [MODIFY] [src/backends/ollama/advanced-renderer.js](file:///Users/guangyu/Projects/utools/utools_local_translate/src/backends/ollama/advanced-renderer.js)
- 实现 `switchTask('ocr')` 的 UI 切换。
- **关键动线**：
    - 进入 OCR 模式 -> `utools.readImage()`。
    - 检测到图片 -> 预检查模型能力 -> 执行 OCR 翻译。
    - 填充三个区域。
    - 监听中部输入框变动，支持“执行重译”。

---

## 3. 验证计划

### 自动化验证
- 编写测试用例验证 `SOURCE:`/`TARGET:` 结构解析算法。
- 验证图片缩放算法在不同分辨率下的输出体积。

### 手动交互路径
1. **列表模式**：截图 -> 在 uTools 输入框按 `Tab` 呼出插件 -> 验证列表中出现原文和译文。
2. **进阶模式**：从列表结果进入进阶翻译 -> 验证侧边栏新增页签及其三段式布局。
3. **编辑流**：在进阶页面手动修改 OCR 错误识别的字符 -> 点击重译 -> 验证顶部结果由新文字生成。
