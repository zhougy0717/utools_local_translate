# PlantUML Lint Skill 设计规范 (2026-04-04)

## 1. 目标 (Goals)
创建一个专门用于修复 Markdown 文件中内嵌 PlantUML 语法错误的 Skill。该 Skill 旨在确保 PlantUML 代码块 100% 可被渲染，通过自动修正语法硬伤和补全必要声明来提高开发效率。

## 2. 核心功能 (Core Features)
- **语法自动修复 (Auto-Fixing)**：识别并修复导致无法渲染的语法错误（如未闭合引号、非法箭头符号等）。
- **Markdown 集成**：专门处理 Markdown 中的 ` ```plantuml ` 块，确保其具有正确的围栏结构。
- **双重校验机制**：
    - **第一层 (Regex)**：快速修复常见的文本级错误。
    - **第二层 (Authority)**：调用本地 `plantuml.jar` 进行 `-syntax` 校验，根据行号进行针对性修复。
- **自动声明补全**：如果检测到元素（如 participant）未定义导致错误，允许 Skill 自动添加声明。
- **Markdown 围栏强制规范**：确保代码块符合 ` ```plantuml\n@startuml\n...\n@enduml\n``` ` 的标准结构。

## 3. 使用场景 (Usage Scenarios)
1. **手动修复**：用户调用 Skill 对指定 Markdown 文件中的 PlantUML 块进行扫描修复。
2. **生成后校验 (Subagent-driven)**：作为子 Agent 的工具，在 Agent 生成 PlantUML 代码后自动运行 Lint 以确保输出质量。

## 4. 技术设计 (Technical Design)

### 4.1 依赖项与配置
Skill 将从 `config.json` 或环境变量读取以下配置：
- `PLANTUML_JAR_PATH`: 用户手动指定的 `plantuml.jar` 绝对路径。
- `JAVA_EXECUTABLE`: Java 运行环境路径（默认为 `java`）。

### 4.2 核心流程 (The Fix-Loop)
对于每一个匹配到的 PlantUML 代码块：
1. **提取**：正则提取 ` ```plantuml ` 到 ` ``` ` 之间的内容。
2. **预修复 (Regex Pass)**：
    - 检查并补全 `@startuml` 和 `@enduml`。
    - 修复未闭合的引号 `"`。
    - 修正基础箭头语法（如 `->`）。
3. **循环校验 (Jar Pass)**：
    - 将内容写入临时文件。
    - 执行 `java -jar <path> -syntax <temp_file>`。
    - 解析输出中的 `Error line (X)`。
    - **启发式修复**：根据错误行上下文尝试修复（补全 `end`、添加 `participant`、移除无效字符）。
    - 重试直到成功或达到 `max_retries` (建议 3 次)。
4. **回填**：将修复后的内容（包含强制的 Markdown 围栏和 `@startuml/@enduml`）写回原文件。

### 4.3 Markdown 围栏约束
强制生成的结构：
\```plantuml
@startuml
[PlantUML Content]
@enduml
\```

## 5. 错误处理 (Error Handling)
- **依赖缺失**：如果找不到 `plantuml.jar`，Skill 报错并提示用户检查配置。
- **不可修复错误**：如果经过多次重试行号不变或报错信息未更新，Skill 将停止修复并返回具体的行号和错误描述。
- **多块处理**：顺序处理文件中的所有 PlantUML 块。

## 6. 后续扩展 (Future Extensions)
- 支持样式/风格检查（目前仅限语法修复）。
- 支持 Ditaa 或其他非 UML 类型的 PlantUML 扩展。
