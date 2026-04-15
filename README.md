# uTools 局部/本地全能翻译中心

一个强大、私密且多功能的 uTools 本地翻译插件。结合了传统词典的高能效与现代 AI 的深度理解能力。

## 🌟 核心特性

- **多模式无缝切换**
  - **离线词典 (Offline Dict)**：基于 ECDICT 与 CC-CEDICT，毫秒级响应，支持英中/中英双向查词。
  - **AI 进阶翻译 (Ollama)**：支持本地 LLM (如 Llama3, Qwen) 或 OpenAI 兼容 API，提供地道润色与深度剖析。
  - **LibreTranslate**：支持自建开源翻译服务，兼顾隐私与多语种能力。

- **Ollama 进阶翻译中心**
  - **深度润色**：不仅仅是翻译，更能优化语义，提供语法剖析。
  - **变量命名**：专为开发者设计，一键生成 Pascal, Camel, Snake, Constant, Kebab 等多种风格。
  - **识图翻译 (Vision)**：支持多模态识图，直接对图片内容进行 OCR 识别并翻译。

- **智能体验**
  - **自动语种侦测**：智能判断中英方向，无需手动干预。
  - **Sticky Mode**：保持指令上下文，实现极致顺滑的 sub-input 交互。
  - **全局代理支持**：内置 HTTP/SOCKS5 代理配置（支持认证），解决网络访问难题。

## ⌨️ 快捷指令 (Slash Commands)

在搜索框输入 `/` 即可触发指令列表：

- `/mode`：切换翻译后端（离线词典、Ollama、LibreTranslate）。
- `/target`：设定全局目标语言（支持自动记忆）。
- `/source`：手动指定源语言（适用于特定后端）。
- `/help`：快速查看使用技巧与文档链接。

## ⚙️ 快速开始

### 1. 离线词典资源获取

插件支持词典自动下载与构建。如果需要手动配置，请将 `ecdict.db` 或 `cccedict.db` 放入资源目录，或通过 `/mode` 触发自动处理流程。

### 2. Ollama 配置

1. 确保本地已安装并运行 [Ollama](https://ollama.com/)。
2. 在插件 `/mode` 中选择 Ollama。
3. 进入配置界面，输入 API 地址（默认 `http://127.0.0.1:11434/v1`）并选择已下载的模型。

## 🛠 开发者指南

### 构建词库
```bash
python3 scripts/build_cccedict.py  # 构建中英词库
python3 scripts/split_dict.py      # 处理分卷词库
```

### 运行测试
```bash
npm test
```

### 打包发布
```bash
python3 scripts/release.py
```

## 📄 开源说明

- **英中词典**：采用 [ECDICT](https://github.com/skywind3000/ECDICT) 数据。
- **中英词典**：数据源自 [MDBG Chinese Dictionary](https://www.mdbg.net/chinese/dictionary?page=cedict)。
- **License**：MIT

---
**提交问题或建议**：[GitHub Issues](https://github.com/zhougy0717/utools_local_translate/issues)
