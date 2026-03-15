---
name: ollama-command-development
overview: 实现 /ollama 命令行配置功能，参考 /libre 命令的实现方式
todos:
  - id: modify-preload
    content: 修改 preload.js：在 appConfig.ollama 默认配置中添加 apiKey 字段
    status: completed
  - id: refactor-ollama-cmd
    content: 重构 commands/ollama.js：参考 libre.js 实现完整的命令行配置逻辑
    status: completed
    dependencies:
      - modify-preload
  - id: implement-handle-search
    content: 实现 handleSearch 方法：解析输入、显示当前状态、提供保存选项
    status: completed
    dependencies:
      - refactor-ollama-cmd
  - id: implement-handle-select
    content: 实现 handleSelect 方法：保存配置、连通性检测、加载模型列表、选择模型
    status: completed
    dependencies:
      - implement-handle-search
  - id: add-helper-methods
    content: 添加辅助方法：_checkConnection、_fetchModels、_getBaseUrl
    status: completed
    dependencies:
      - implement-handle-select
---

## 需求概述

按照 spec-00021 设计文档，实现仿照 /libre 命令的 ollama 配置命令。

## 核心功能

1. 命令行快速配置：支持 `/ollama <url> [key]` 格式
2. 配置项：apiBase（API地址）、apiKey（密钥）、model（模型）、prompt（提示词）
3. 连通性检测：配置完成后自动检测 Ollama 服务可用性
4. 模型列表加载：自动从服务器获取可用模型列表
5. 后端切换：配置成功后自动切换到 Ollama 后端

## 用户交互流程

- 输入 `/ollama` → 显示当前配置状态和连通性检测
- 输入 `/ollama http://127.0.0.1:11434/v1 key` → 显示保存选项，点击后检测连接、加载模型列表、选择模型后保存配置

## 技术方案

### 技术选型

- **运行环境**：uTools 插件环境（浏览器环境）
- **实现模式**：参考 commands/libre.js 的命令处理模式
- **网络请求**：fetch API

### 关键实现细节

1. **命令处理模式**：

- handleSearch：解析用户输入，提取 apiBase 和 apiKey 参数
- handleSelect：处理保存配置、连通性检测、模型选择等 action

2. **配置存储**：

- 使用 utools.dbStorage 持久化配置
- 配置对象：appConfig.ollama = { apiBase, apiKey, model, prompt }

3. **Ollama API 调用**：

- 模型列表 API：GET {baseUrl}/api/tags
- baseUrl 处理：需要去掉 /v1 后缀

4. **参考代码**：

- commands/libre.js 已实现完整的命令行配置逻辑，直接参考其模式