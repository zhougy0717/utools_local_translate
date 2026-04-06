# Tasks - 多模态图片翻译实施

- [x] 1. 配置 `plugin.json` 增加 `img` 指令支持
- [x] 2. 在 `PromptManager` 中增加 `vision` 提示词模板
- [x] 3. 在 `BackendManager` 中实现 `queryImage` 路由逻辑
- [x] 4. 在 `OllamaBackend` 中实现多模态请求逻辑
- [x] 5. 在 `preload.js` 中接入图片输入分发
- [x] 6. 编写并运行单元测试
    - [x] `test/prompt_manager.test.js`
    - [x] `test/ollama_vision.test.js`
- [/] 7. 最终聯调验证
