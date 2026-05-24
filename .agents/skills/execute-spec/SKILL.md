---
name: execute-spec
description: 当你收到一份规格说明书 (spec) 文档，并且需要执行完整的开发生命周期（设计、TDD、审查、QA）来落地实现该功能时使用。
---

# /execute-spec

## 概览
此命令通过调度 **Tech Leader** 代理及完整的代理团队，自动化地实现技术规格说明书。

## 何时使用
- 当用户提供了一个规格说明文档的路径（例如：`docs/spec/YYYY-MM-DD-feature.md`）。
- 当用户明确输入了 `/execute-spec` 命令时。

## 编排流程

1. **读取规格说明**：读取提供的 spec 文件，以理解需求和成功标准。
2. **承担 Tech Leader 角色**：你必须遵循 `tech-leader` 代理的协议（或将其委托给它）。
3. **执行标准工作流**：
    - **步骤 1 (Planner/Designer)**：创建/评审实现计划。
    - **步骤 2 (TDD Guide)**：使用 RED-GREEN-REFACTOR 进行开发。
    - **步骤 3 (Reviewer)**：进行代码和安全审查。
    - **步骤 4 (QA)**：执行单元测试、端到端测试 (E2E) 和验收测试。
4. **最终批准**：只有当 `qa` 代理给出绿灯信号，且所有项目标准都得到满足时，才视为任务完成。

## 执行示例

**用户**：`/execute-spec docs/spec/2026-04-23-agent-notifier-design.md`

**Agent**：
1. 读取 `docs/spec/2026-04-23-agent-notifier-design.md`。
2. 激活 `tech-leader` 工作流。
3. 调用 `planner` 生成执行步骤。
4. 调用 `tdd-developer` 进行代码实现。
5. 调用 `rust-reviewer` 进行代码质量检查。
6. 调用 `qa` 进行最终验证。
