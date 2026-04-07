# 图片翻译功能开发任务

- [x] 1. 配置入口：在 `plugin.json` 增加 `img` 类型的指令支持 (已确认存在)
- [x] 2. 提示词增强：更新 `PromptManager` 并在 `OllamaBackend` 实现结构化解析 (SOURCE:/TARGET:)
- [x] 3. 后端升级：在 `OllamaBackend` 实现视觉能力检测与多模态请求封装
- [x] 4. 管理层调度：在 `BackendManager` 实现专用的 Ollama 直接分发逻辑与路径隔离
- [x] 5. 展现层增强：更新 `ViewPresenter` 支持在快速列表中显示识别出的原文
- [x] 6. 输入侧优化：在 `preload.js` 实现基于 Canvas 的图片等比压缩预处理 (1024px)
- [x] 7. 进阶 UI 实现：在 `advanced-panel.html` 和 `renderer.js` 构建三段式交互界面，支持粘贴识图
- [x] 8. 联调测试与验证 (代码实现已完成)
