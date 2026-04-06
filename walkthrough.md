# Walkthrough - 多模态图片翻译实现

我们已经成功实现了基于 Ollama 多模态模型的图片翻译功能。现在，当你在剪贴板抓取截图并打开 uTools 时，可以直接触发翻译流。

## 变更内容

### 1. 触发与入口
- **[plugin.json](file:///c:/Users/Banny/code/local_translate/plugin.json)**: 增加了 `img` 类型的命令。这允许 uTools 识别剪贴板图片并建议使用“图片翻译”。
- **[preload.js](file:///c:/Users/Banny/code/local_translate/preload.js)**: 在 `enter` 回调中增加了对 `action.type === 'img'` 的处理。它会自动提取图片 DataURL 并转交给后端。

### 2. 后端核心
- **[backend_manager.js](file:///c:/Users/Banny/code/local_translate/src/core/backend_manager.js)**: 新增了 `queryImage` 路由方法，能够判断当前后端是否支持视觉任务。
- **[ollama/index.js](file:///c:/Users/Banny/code/local_translate/src/backends/ollama/index.js)**: 实现了 `queryImage` 方法。它使用 OpenAI 兼容的视觉 Payload（`content` 数组形式）向 Ollama 发起请求。
- **[prompt-manager.js](file:///c:/Users/Banny/code/local_translate/src/backends/ollama/prompt-manager.js)**: 新增了 `vision` 任务模板，专门优化了图片 OCR 提取与翻译的 Prompt。

### 3. 质量保证
- **[ollama_vision.test.js](file:///c:/Users/Banny/code/local_translate/test/ollama_vision.test.js)**: 新增单元测试，模拟了视觉模型的请求 Payload 校验及异常处理。
- **[prompt_manager.test.js](file:///c:/Users/Banny/code/local_translate/test/prompt_manager.test.js)**: 更新测试以验证 `vision` 模板。

## 验证结果

### 单元测试
运行 `node --test test/ollama_vision.test.js test/prompt_manager.test.js` 全部通过：
- ✅ `PromptManager`: 成功加载并替换视觉模板。
- ✅ `OllamaBackend`: 成功构造符合规范的视觉 Payload。
- ✅ `OllamaBackend`: 能够正确处理非视觉模型的报错。

## 使用说明
1. 确保 Ollama 正在运行，并拉取了支持视觉的模型（如 `llava`）。
2. 在插件设置中将 **模型名称** 设置为对应的视觉模型名。
3. 截图（如 `Win+Shift+S`）后，打开 uTools。
4. 在搜索框列表下选择 **“图片翻译”**。
5. 稍等片刻，翻译结果将直接呈现在列表中。

> [!TIP]
> 建议使用 `llava:7b` 或 `qwen-vl` 等模型以获得最佳平衡的识别速度与准确度。
