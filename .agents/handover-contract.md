# Handover Contract（移交契约）

> 本文件是所有 Agent 之间任务移交的 **Single Source of Truth**。所有 Agent 定义文件通过引用本文件获取契约规则。

## 核心规则

1. **严守边界**：每个 Agent 只做自己"核心职责"内的事，不越界生产下游 Agent 的交付物。
2. **人类闸门**：标记为 🚦 的移交点必须获得人类的明确批准才能继续。Agent 不得自行跳过。
3. **交付物即契约**：上游 Agent 的输出格式就是下游 Agent 的输入格式，不允许口头传递上下文。
4. **失败即停止**：如果无法产出符合规格的交付物，停下来向人类报告，不要用低质量输出糊弄下游。

## 移交链与交付物定义

| 序号 | 上游 Agent | 交付物 | 存放路径 | 🚦 | 下游 Agent |
|------|-----------|--------|---------|:--:|-----------|
| H-01 | **requirements-analyst** | 需求规格书 (Requirements Spec) | `doc/spec/YYYY-MM-DD-<topic>-requirements.md` | 🚦 | **designer** |
| H-02 | **researcher** | 调研报告 (Research Report) | `doc/research/NNNN-<topic>.md` | — | **designer** |
| H-03 | **designer** | 设计规格书 (Design Spec) | `doc/spec/spec-NNNN-<topic>-design.md` | 🚦 | **ui-developer** / **planner** |
| H-04 | **ui-developer** | 前端代码 (HTML/CSS/JS) | `index.html`, `src/` | — | **planner** |
| H-05 | **planner** | 实现计划 (Implementation Plan) | 对话内输出（不落盘） | — | **tdd-developer** |
| H-06 | **tdd-developer** | 已通过测试的代码 | `preload.js`, `src/` | — | **js-reviewer** |
| H-07 | **js-reviewer** | Review 报告 (Pass/Block) | 对话内输出 | — | **security-reviewer** 或 **qa** |
| H-08 | **security-reviewer** | 安全审查报告 (Pass/Block) | 对话内输出 | — | **qa** |
| H-09 | **qa** | 测试报告 (Pass/Fail) | 对话内输出 | — | **doc-updater** |
| H-10 | **doc-updater** | 更新后的文档 | `doc/`, `README.md` | — | ✅ 完成 |

## 特殊路径

- **bug-fixer**：由 tech-leader 在熔断时调度，交付修复后的代码，返回 tdd-developer 继续。
- **build-error-resolver**：由任何 Agent 在构建失败时调度，交付最小修复，返回原 Agent。
- **poc-developer**：跳过 planner，直接实现后调度 qa 进行本地功能验证。

## 移交消息模板

每次移交时，上游 Agent 必须在消息中包含以下结构化信息：

```
## 移交摘要

**从**: [上游 Agent 名称]
**到**: [下游 Agent 名称]
**任务**: [一句话描述]
**交付物路径**: [文件路径或"对话内输出"]
**关键上下文**:
- [上下文 1]
- [上下文 2]
**待下游关注**:
- [注意事项 1]
**人类审批状态**: ✅ 已批准 / ⏳ 待批准
```
