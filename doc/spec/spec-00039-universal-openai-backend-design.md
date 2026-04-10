# Spec-00039: 通用 OpenAI 兼容后端支持 (Universal OpenAI-Compatible Backend)

## 1. 背景 (Background)

当前的 `OllamaBackend` 实现高度依赖于 Ollama 特有的私有 API（如 `/api/tags` 和 `/api/show`），用于执行模型管理任务（如列出已下载模型）和探测多模态（Vision）识图能力。

当用户通过“Ollama”配置连接腾讯混元（Tencent Hunyuan）或 DeepSeek 等远程 OpenAI 兼容服务时，这些私有 API 调用会返回 **HTTP 404 Not Found** 错误。这不仅导致连接测试失败，也使得用户无法在 UI 中选择云端模型。

## 2. 目标 (Objective)

将现有的“Ollama”后端升级为**通用大模型后端 (Universal LLM Backend)**：
- **统一模型发现**：使用 OpenAI 标准的 `GET /v1/models` 接口作为统一的模型获取方式。
- **混合探测逻辑 (Hybrid Detection Strategy)**：保留对本地 Ollama 专有接口的探测以提升精准度，但对无法探测的云端服务采取“宽容模式”。
- **错误透明化回显**：直接向用户反馈服务端返回的原始错误信息（如：模型不支持图片输入）。

## 3. 架构设计 (Architecture)

### 3.1 统一模型列表获取 (Unified Model Discovery)

摒弃 Ollama 专有的 `/api/tags` 接口，**全量采用官方标准的 `/v1/models` 端点**。插件在初始化和刷新列表时，负责将不同服务商返回的 JSON 数据归一化为统一的模型 ID 列表。

### 3.2 识图能力探测 (Vision Capability Detection)

采取“有则显示、无则放行”的混合探测策略：
1. **优先检测 (本地)**：依然尝试请求 Ollama 的 `POST /api/show` 接口。
2. **宽容放行 (云端/异常)**：若请求返回 404 或超时（云端服务），系统不再禁用识图功能，直接告知前端已进入“云端/宽容模式”。
3. **按需纠错**：仅在实际传递图片数据，且模型服务返回 400 校验错误时，捕获并展示具体错误原因。

## 4. 实施要点 (Implementation Notes)

### 4.1 后端代码 (`src/backends/ollama/index.js`)
- 将 `testConnection` 路径彻底改为 `/v1/models`。
- 改进 `checkVisionCapability`：捕获 `api/show` 异常，非确凿报错一律放行。
- 强化 `fetchChat`：增强对 400 等状态下 API 错误 body 的解析能力。

## 5. 兼容性与错误处理 (Compatibility & Error Handling)

- 如果服务返回 404 且涉及模型列表，提示“无法探测到模型，请检查 Base URL 是否正确”。
- 如果在运行时发生识图错误，直接透传具体的错误描述。

## 6. 测试设计 (Testing Design)

### 6.1 单元测试 (Unit Tests)
主要针对 `OllamaBackend` 类的核心逻辑进行 Mock 测试：
- **模型发现测试 (Discovery Test)**：
    - Mock Ollama 的 `/v1/models` 返回（带有详细的 data 列表）。
    - Mock 混元等标准 OpenAI 的 `/v1/models` 返回。
    - 验证解析器输出的有效性和一致性。
- **识图能力探测测试 (Vision Capability Mock)**：
    - 测试 `api/show` 返回 200 (支持)。
    - 测试 `api/show` 返回 200 (明确不支持)。
    - 测试 `api/show` 返回 404 (宽容放行模式)。
- **错误响应提取测试 (Error Extraction)**：
    - Mock HTTP 400 响应，body 包含 `{ "error": { "message": "unsupported model" } }`，验证插件是否能正确提取 message。

### 6.2 集成测试 (Integration Tests)
- **本地 Ollama 联测**：验证本地环境下模型列表显示和识图开关状态是否正常。
- **混元/远程服务模拟**：使用 Mock 服务器模拟远程 OpenAI compatible 接口的行为，确保整个链路在 404 下不中断。

## 7. 兼容性 (Compatibility)
- 保持对 Ollama 本地环境的深度集成。
- 自动支持腾讯混元、DeepSeek 系列以及所有标准的 OpenAI 兼容服务。
