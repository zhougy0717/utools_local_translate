# AGENTS.md — uTools Local/Offline Translation Center

> 一个强大、私密且多功能的 uTools 本地翻译插件。结合了传统离线词典的高能效（基于 sql.js / SQLite 查询 ECDICT 与 CC-CEDICT 数据库）与现代本地 AI/大模型（基于 Ollama）及三方 API（LibreTranslate、OpenAI）的深度理解与多功能翻译能力。

## 项目概览

**架构：** uTools 主搜索框/Sub-input ──▶ 指令分发 (CommandManager) ──▶ preload.js (Bridge & APIs)  
**运行环境与技术栈：** uTools 插件环境 (CommonJS, Node.js + HTML/CSS/JS WebView)  
**主要组件与依赖：**  
- **核心逻辑**：`preload.js`, `src/` (管理翻译后端、代理配置、指令、以及视图展示)
- **数据库**：`sql.js` (处理 `ecdict.db` / `cccedict.db` 离线词库)
- **网络与代理**：`node-fetch` + `https-proxy-agent` + `socks-proxy-agent` (支持认证和全局代理配置)
- **测试框架**：Node.js 原生测试运行器 (`node --test`)
- **设计文档**：`doc/spec/` (例如 `spec-00038-multimodal-image-translation-ollama.md`, `spec-00044-mode-command-refactoring.md`)

```
uTools 输入框/粘性模式
      │
      ▼
CommandManager (指令路由：/mode, /target, /source, /help)
      │
      ▼
preload.js (API 桥接层)
      │
      ├──────────────────────┼──────────────────────┐
      ▼                      ▼                      ▼
离线词库 (sql.js)      本地/云端大模型 (AI)      网络代理管理器
(ECDICT & CC-CEDICT)  (Ollama/LibreTranslate)  (HTTP/SOCKS5 + 证书)
```

---

## Agent 团队

### 可用 Agent

| Agent | 职责 | 何时使用 |
|-------|------|---------|
| **tech-leader** | 统筹开发全流程 | 完成整个开发周期（规划、TDD开发、Review、测试）、多Agent调度 |
| **requirements-analyst** | 需求澄清与 UI 原型设计 | 需求边界不清晰、需要问答明确意图、涉及 UI 交互设计时 |
| **planner** | 实现规划与需求拆解 | 复杂功能、架构变更、多步骤任务 |
| **designer** | 软件架构与流程设计 | 新功能设计、系统变更建模、测试策略规划 |
| **js-reviewer** | JavaScript 代码审查 | 所有 JS/HTML/CSS 代码变更后，聚焦模块规范、异步错误与 uTools 集成安全 |
| **security-reviewer** | 安全漏洞检测与修复 | 涉及网络代理、凭证存储、WebView 渲染 XSS 防护、图片 Base64 传输限制变更后 |
| **tdd-developer** | 测试驱动开发引导 | 新功能实现、Bug 修复，严格遵循 RED-GREEN-REFACTOR |
| **build-error-resolver** | 构建与测试错误快速修复 | `npm test` 失败或集成环境报错时 |
| **doc-updater** | 文档同步维护 | 功能完成、API 变更后，更新相关设计规约及 README |
| **poc-developer** | 敏捷开发工程师 | 快速实现功能/修复 Bug，专注于本地 uTools 环境真实性验证与数据契约校验 |
| **qa** | 质量保证与测试验收 | 代码 Review 完成后，执行单元测试、代理连通性、OCR 预处理及数据契约验证 |
| **researcher** | 技术可行性调研 | 评估本地大模型接口规范、代理隧道转发、第三方 API 限制时 |
| **bug-fixer** | 专项源码审计与修复 | 修复开发尝试 3 次仍未解决的 Bug，或 SDK 级调用报错 |
| **ui-developer** | 基于 Pencil 原型的前端开发 | 需要将原型设计稿转化为 vanilla HTML/CSS/JS 界面代码时 |

Agent 定义文件位于 `.agents/agents/` 目录。

### Agent 编排

根据任务类型自动选择 agent，无需用户提示：

- 完整开发周期请求 → **tech-leader**（调度全流程：TDD -> Review -> QA）
- 需求模糊/边界不清/需要问答明确意图 → **requirements-analyst**
- 涉及 UI 交互设计/需要 Pencil 原型 → **requirements-analyst**
- 复杂功能请求 → **planner**
- 新功能或系统变更的架构设计 → **designer**
- 代码刚写完/修改完 → **js-reviewer**
- Bug 修复或新功能 → **tdd-developer**
- 快速迭代/紧急修复且需本地真实测试验证 → **poc-developer**
- 涉及代理配置/凭证存储/HTML渲染安全代码 → **security-reviewer**
- 测试或编译失败 → **build-error-resolver**
- 功能完成后 → **doc-updater**
- Review 完成后全面测试 → **qa**
- 技术可行性评估 → **researcher**
- 内部 API 调用异常或 TDD 开发阻塞 3 次熔断时 → **bug-fixer**
- 需要实现进阶翻译中心等 UI 界面与样式 → **ui-developer**

**工作流串联示例：**
```
用户请求新功能（或由 tech-leader 统筹全流程）
  → requirements-analyst（需求澄清与 UI 原型设计，输出需求规格书）
  → researcher（技术可行性调研，如涉及本地 AI 或代理层变更）
  │   🚦人类审批
  → designer（架构设计与接口契约建模，输出设计规格书）
  │   🚦人类审批
  → ui-developer（前端界面与样式实现，如进阶面板）
  → planner（将设计与界面拆解为可执行的实现步骤）
  → tdd-developer（RED-GREEN-REFACTOR 循环实现）
  → js-reviewer（JavaScript 规范及 uTools 特性审查）
  → security-reviewer（安全审查，如 XSS 过滤、敏感代理密码脱敏）
  → qa（单元测试、代理集成连通性、数据契约校验）
  → doc-updater（更新设计规约和文档）
```

---

### Handover Contract（移交契约）

所有 Agent 之间的任务移交必须遵循项目制定的移交契约。该契约定义了核心规则、移交链、交付物标准以及人类审批闸门。

> 完整契约定义请参阅：[.agents/handover-contract.md](file:///.agents/handover-contract.md)

---

### 斜线命令 (Slash Commands)

- **/execute-spec <spec_path>**：输入一份 spec 文档，调用 **tech-leader** developer 统筹 agent team 完成从设计到 QA 的全流程开发工作。

## 核心原则

### 1. 先思考，再编码

**不要假设。不要隐藏困惑。呈现权衡。**

- 明确说明你的假设。如果不确定，**问**，而不是猜。
- 如果存在多种解读，列出它们 — 不要默默选一个。
- 如果存在更简单的方案，说出来。该反驳时就反驳。
- 如果有不清楚的地方，**停下来**。指出哪里让你困惑，然后提问。
- **没有得到人类的允许，禁止直接开始编码**：在编写任何非平凡修改或新功能的生产代码之前，必须先经过设计方案（UML、契约或实施计划）的设计，并获得人类的明确批准（🚦 审批闸门）。

### 2. 简洁优先

**用最少的代码解决问题。不写推测性代码。**

- 不添加未被要求的功能。
- 不为只用一次的代码创建抽象。
- 不添加未被请求的"灵活性"或"可配置性"。
- 不为不可能的场景编写错误处理。
- 如果你写了 200 行代码，但 50 行就够了，重写。

检验标准：*一个资深工程师会说这太复杂了吗？* 如果是，精简它。

### 3. 精准修改

**只动必须动的部分。只清理你自己造成的问题。**

编辑已有代码时：
- 不要"顺手改进"相邻的代码、注释或格式。
- 不要重构没坏的东西。
- 匹配已有的代码风格，即使你会用不同的方式写。
- 如果发现无关的死代码，**提一下** — 但不要删它。

当你的修改产生了孤立代码时：
- 删除因**你的修改**而变成未使用的 import/变量/函数/样式。
- 不要删除修改前就已经存在的死代码，除非被要求。

检验标准：*每一行修改都应该能直接追溯到用户的请求。*

### 4. 目标驱动执行

**定义成功标准。循环直到验证通过。**

将任务转化为可验证的目标：
- "添加验证" → "为无效输入编写测试，然后让测试通过"
- "修复 bug" → "编写复现 bug 的测试，然后让测试通过"
- "重构 X" → "确保重构前后测试都通过"

对于多步骤任务，陈述简要计划：
```
1. [步骤] → 验证：[检查项]
2. [步骤] → 验证：[检查项]
3. [步骤] → 验证：[检查项]
```

### 5. 安全意识

**绝不在安全性上妥协 — 本插件运行在 Electron WebView 且处理敏感凭证与代理配置。**

- **WebView XSS 防护**：在将外部翻译结果或拼写联想渲染至 DOM 时，绝不直接将不受信任的内容作为 raw HTML 注入。使用 `textContent` 或严格的 HTML 净化。
- **敏感凭证安全存储**：API 秘钥、代理服务器密码禁止以明文形式明文落盘。必须使用 uTools 提供的安全存储 API 或进行加密处理。
- **代理密码防泄露**：确保代理鉴权信息和密码不会被泄露到应用日志、配置界面或抛出至控制台的 Error 堆栈中。
- **IPC 传输尺寸控制**：识图翻译 (Vision) 的大图 Base64 数据必须执行预缩放（限制长边在 1024px 内）与 JPEG 0.8 质量压缩，防止 IPC 通道死锁与 OOM 崩溃。

---

## 项目专属规范

### JavaScript / uTools 编码约定

- **模块规范**：采用 **CommonJS**。确保 `require` 和 `module.exports` 路径及用法正确。
- **uTools 环境检查**：在访问 `utools` 全局变量前必须进行安全检查（`typeof utools !== 'undefined'`），保证在单元测试（Node 纯执行环境）中不崩溃。
- **`this` 绑定丢失防护**：当模块单例方法（如 `BackendManager` 的 stop 方法）或配置面板入口暴露给 `window` 全局挂载时，**必须**显式调用 `.bind()`，以防 this 指针丢失。
- **异步控制与错误处理**：网络请求（如 Ollama API 交互、LibreTranslate 直连或代理通道）和 SQLite 查询必须包裹在 `try...catch` 中，发生错误时应及时终止 UI 的 Loading 状态，禁止吞掉异常。
- **防抖机制 (Debounce)**：对频繁触发的 AI 查词，必须在入口层应用防抖（如 `SEARCH_DEBOUNCE_MS = 300`），避免高频键入时发起大量重复网络请求。
- **SQLite 内存释放**：涉及 `sql.js` 数据库查询时，确保临时分配的 SQLite 查询句柄（statement）或连接及时关闭/释放，防止内存泄漏。
- **DOM & CSS 规范**：界面元素布局需保持一致，CSS 变量（如色彩、阴影、圆角）集中在 `:root` 声明，禁止使用内联样式。

### API 契约与指令交互

uTools 插件的快捷指令入口配置于 `plugin.json`，并由 `CommandManager` 进行粘性模式 (Sticky Mode) 和普通翻译的分发：
- `/mode`：切换翻译后端。
- `/target`：设定全局目标语言。
- `/source`：手动指定源语言。
- `/help`：查看使用技巧与文档链接。

任何新增加的快捷指令都应优先在 `CommandManager` 路由表中进行规范声明，防止与 uTools 系统搜索框的默认路由冲突。

### 文件组织

```
utools_local_translate/
├── AGENTS.md                      # 本文件 — AI 代理行为准则
├── README.md                      # 项目说明文档
├── plugin.json                    # uTools 插件配置文件
├── preload.js                     # 插件 preload 脚本 (uTools 桥接与核心逻辑)
├── index.html                     # 翻译结果/面板主页面
├── src/                           # 核心业务源码
│   ├── backends/                  # 各翻译后端适配 (ollama, libretranslate, ccdict 等)
│   ├── commands/                  # 快捷指令模块 (/mode, /target 等)
│   ├── core/                      # 后端管理、代理路由与状态同步核心
│   └── utils/                     # 辅助库（图片压缩、文本检测、视图构造等）
├── doc/                           # 项目设计文档与 Spec 规约
├── test/                          # 单元测试用例
└── scripts/                       # 词库构建与打包发布自动化脚本
```

- 核心交互逻辑拆分为细粒度模块，单个 JS 文件控制在 400 行以内，上限 800 行。
- 业务逻辑与 UI 渲染分离：`src/core/` 聚焦状态与通信，`src/utils/view_presenter.js` 负责列表项组装。

---

## 开发工作流

### 1. 先分析需求，再设计

在编写任何复杂特性的代码之前：
- 使用 **requirements-analyst** agent 通过问答澄清需求边界，涉及新页面时使用 Pencil 创建原型。
- 将需求文档写入 `doc/spec/YYYY-MM-DD-<主题>-requirements.md`。
- 在实现之前获得用户批准。

### 2. 测试驱动开发

所有功能和 Bug 修复都使用 **test-driven-development** 技能：

```
RED    → 编写一个失败的测试
GREEN  → 编写最少量的代码使测试通过
REFACTOR → 清理代码，保持测试通过
```

- **没有失败的测试，就不写生产代码。**
- 使用 `npm test` 运行 Node.js 单元测试。
- 对网络请求和代理行为编写 mock（利用 `nock` 或自定义 Mock 服务器）。

### 3. 构建与验证

```bash
# 运行单元测试
npm test

# 构建/打包插件
python3 scripts/release.py
```

### 4. Git 工作流

所有代码提交必须严格遵守 **git-commit** 技能规范：
- **禁止在调试阶段提交**：在问题尚未彻底查明、仍处于调试或试错打补丁阶段时，**严禁**通过 git 提交代码（避免产生大量垃圾/脏提交）。必须在问题完全解决并在真实环境中验证通过后，才能进行统一的最终提交。
- **强制使用英文**：标题和正文均须为英文。
- **结构化格式**：采用 `<type>: <description>` 格式。
- **包含详尽正文**：除琐碎修改外，必须包含 Summary、Implementation 和 Effect 详情。
- 详情请参阅：[.agents/skills/git-commit/SKILL.md](file:///.agents/skills/git-commit/SKILL.md)

---

## 编码检查清单

在完成任何任务之前，确认以下各项：

- [ ] 所有单元测试 100% 通过（`npm test`）
- [ ] 所有 `require` 引入在 preload 和 src 路径中正确无误
- [ ] 对 `utools` 的全局访问均有 `typeof utools !== 'undefined'` 的安全防护
- [ ] WebView HTML 渲染已防范 XSS 漏洞，未使用危险的 innerHTML 拼接不可信数据
- [ ] 代理配置中的用户名密码与 API Key 未泄露在日志或 Error 堆栈中
- [ ] 图片翻译（vision 识图）的大图已在 Canvas 中缩放压缩，Base64 传输体积受控
- [ ] 频繁触发的查词已引入 `SEARCH_DEBOUNCE_MS` 防抖
- [ ] sql.js 的 SQLite 数据库连接与 statement 句柄已在查询后正常关闭/释放
- [ ] 每一行代码修改都可追溯到用户的需求，不引入推测性代码
- [ ] Git commit 信息符合 git-commit 规范

---

## 权衡说明

这些准则倾向于**谨慎而非速度**。对于简单任务（如快捷指令样式微调、显而易见的一行错误修复），请使用判断 — 并非每个修改都需要完整流程。目标是减少跨模块交互和 uTools 复杂状态管理中的代价高昂的错误，而非拖慢简单任务。

---

## 成功指标

- 所有测试用例 100% 绿灯（`npm test`）
- 插件在 uTools 开发预览模式下加载正常，且不报任何 Module 错误
- 离线数据库查询耗时在数毫秒级，无明显的内存泄露
- 代理配置在有密码认证或跳过证书校验时，可正常保障大模型网络请求穿透
- 图片翻译流程流畅，长图/大截图无卡顿崩溃
- WebView 安全防护达标，对任何脏数据安全过滤
