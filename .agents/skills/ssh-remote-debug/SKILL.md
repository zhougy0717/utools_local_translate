---
name: ssh-remote-debug
description: Use when debugging the remote OpenCode plugin, verifying SSH tunnel connectivity, or diagnosing why notifications are not arriving at the local Tauri application.
tools: ["Read", "Grep", "Glob", "Shell"]
permissions: ["Allow running ssh commands", "Allow running curl commands", "Allow reading remote logs"]
---

# SSH Remote Debug (SSH 远端调试)

## 概览

本项目通过 SSH 反向隧道连接远端 OpenCode 环境和本地 Tauri 应用。调试此链路需要在 **本地 → 隧道 → 远端** 三层中定位故障点。核心原则：**逐层验证，从近到远**。

## 何时使用

- 远端 OpenCode 插件未触发本地系统通知
- SSH 隧道配置后无法确认连通性
- 需要查看远端插件运行日志
- 本地 Tauri 服务器收不到请求
- 排查 `permission.ask` 钩子是否被正确调用

## 环境配置

### SSH Config 位置

```
Windows: %USERPROFILE%\.ssh\config
Linux/macOS: ~/.ssh/config
```

### 获取可用 SSH Host

```powershell
# Windows PowerShell
type $env:USERPROFILE\.ssh\config | Select-String -Pattern "Host "
```

```bash
# Linux/macOS
grep "^Host " ~/.ssh/config
```

> **重要**：不要假设远端主机名。始终从 SSH config 中读取实际配置的 Host。

### ProxyCommand 注意事项

如果 SSH config 中配置了 `ProxyCommand`（如 `connect -H 127.0.0.1:7890 %h %p`），需要确保本地安装了代理工具，否则连接会失败并报 `CreateProcessW failed error:2`。

解决方法：
1. 确保代理工具 (`connect`) 在 PATH 中
2. 或临时跳过代理：`ssh -o ProxyCommand=none <host>`
3. 或确认代理进程（如 Clash/V2Ray）正在运行

## 调试工作流（逐层验证）

### 第 1 层：本地服务器

```powershell
# 检查 Tauri 后端是否在监听
netstat -ano | findstr :12345

# 手动发送测试请求
curl -X POST http://127.0.0.1:12345/ask -H "Content-Type: application/json" -d "{\"request_type\":\"permission\",\"data\":{\"title\":\"test\"}}"
```

**预期**：本地弹出系统通知。如果失败，问题在本地服务器，与 SSH/远端无关。

### 第 2 层：SSH 隧道

```powershell
# 建立带反向隧道的 SSH 连接
ssh -R 12345:127.0.0.1:12345 <host>

# 在远端验证隧道端口
ss -tlnp | grep 12345
# 或
netstat -tlnp | grep 12345
```

**预期**：远端 `127.0.0.1:12345` 处于 LISTEN 状态。

```bash
# 在远端通过隧道发送测试请求
curl -X POST http://127.0.0.1:12345/ask -H "Content-Type: application/json" -d '{"request_type":"permission","data":{"title":"tunnel-test"}}'
```

**预期**：本地弹出通知。如果第 1 层通过但此步失败，问题在隧道配置。

### 第 3 层：远端插件日志

```powershell
# 从本地通过 SSH 查看远端日志
ssh <host> "cat /tmp/agent-notifier.log | tail -50"

# 实时跟踪日志
ssh <host> "tail -f /tmp/agent-notifier.log"
```

**关键日志关键词**：

| 日志内容 | 含义 |
|---------|------|
| `Plugin initialized` | 插件已加载 |
| `permission.ask triggered` | 权限钩子被调用（✅ 正常） |
| `Notified local server` | 通知已发送（✅ 正常） |
| `Failed to notify local` | 发送失败（❌ 检查隧道） |
| 无任何 `permission.ask` 日志 | 钩子未触发（❌ 检查插件注册） |

### 第 4 层：OpenCode 插件加载

```bash
# 确认插件文件位于正确目录
ls -la ~/.config/opencode/plugins/agent-notifier.js
# 或项目级
ls -la .opencode/plugins/agent-notifier.js

# 查看 OpenCode 启动日志中的插件加载信息
opencode run --print-logs 2>&1 | grep -i "plugin\|agent-notifier"
```

## OpenCode 插件 API 速查

### 钩子签名

`permission.ask` **不是事件**，而是独立的命名钩子：

```javascript
// ✅ 正确 — 独立命名钩子，input/output 模式
"permission.ask": async (input, output) => {
  // input: Permission 对象
  //   { id, type, title, sessionID, messageID, callID?, pattern?, metadata, time }
  // output: { status: "ask" | "deny" | "allow" }
}

// ❌ 错误 — 这是事件监听器，permission.asked 不会通过此路径触发
event: async ({ event }) => {
  if (event.type === "permission.asked") { ... }
}
```

### Permission 类型

```typescript
type Permission = {
  id: string
  type: string          // 权限类型
  pattern?: string | string[]
  sessionID: string
  messageID: string
  callID?: string
  title: string         // 显示给用户的标题
  metadata: Record<string, unknown>
  time: { created: number }
}
```

### 其他常用钩子

```javascript
// 工具执行前拦截
"tool.execute.before": async (input, output) => {
  // input: { tool: string, sessionID, callID }
  // output: { args: any }
}

// 事件监听（用于 session.idle 等被动事件）
event: async ({ event }) => {
  // event.type: "session.idle" | "session.created" | ...
}

// 结构化日志
await client.app.log({
  body: { service: "agent-notifier", level: "info", message: "..." }
})
```

### 源码参考

- 钩子定义：[packages/plugin/src/index.ts](https://github.com/anomalyco/opencode/blob/dev/packages/plugin/src/index.ts) (Hooks interface, line 227+)
- Permission 类型：[packages/sdk/js/src/gen/types.gen.ts](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)

## 常见错误

| 错误现象 | 根因 | 修复 |
|---------|------|------|
| 远端无日志输出 | 插件未被加载 | 检查文件路径和 `opencode.json` 配置 |
| `permission.ask` 从不触发 | 使用了 `event` 监听器而非命名钩子 | 改用 `"permission.ask": async (input, output) => {}` |
| `CreateProcessW failed` | SSH ProxyCommand 工具不在 PATH | 安装代理工具或跳过代理 |
| `All links failed` | SSH 隧道未建立或已断开 | 重新建立 `ssh -R 12345:...` 连接 |
| `os error 10048` | 端口 12345 已被占用 | `netstat -ano \| findstr :12345` 找到并终止占用进程 |
| `client.app.log("string")` 报错 | 调用签名不正确 | 改用 `client.app.log({ body: { service, level, message } })` |
