# Antigravity 行为指南

本文档记录了 Antigravity 在当前项目中的特定行为准则与最佳实践。

## 绘图规范 (Diagramming Rules)

1. **PlantUML 语法校验**：
   - 每次生成或修改包含 `plantuml` 代码块的 Markdown 文件后，必须使用 `plantuml-lint` 对代码块进行语法检视。
   - 校验命令示例：`node .agents\skills\plantuml-lint\scripts\linter.js <文件路径>`。
   - 确保生成的图表 100% 可被正常渲染。
   - 注意：如果 Linter 自动修复后的语法有误（如将 `-up->` 转换分解），需手动进行校正。

2. **架构描述原则**：
   - Preload.js 应当保持极简，作为“薄桥梁（Thin Bridge）”存在，不应感知具体的业务逻辑和 UI 细节。
   - 复杂的业务逻辑必须下沉到主目录下的 Service 或 Utility 类中。
