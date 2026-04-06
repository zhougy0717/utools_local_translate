# Spec-00037: Ollama 进阶翻译中心 - 变量命名多风格集成

## 1. 背景与目标
在开发过程中，开发者经常需要将中文业务描述转换为符合代码规范的变量名。现有的 Ollama 进阶翻译中心虽然可以完成翻译，但需要用户手动指定命名风格且结果单一。
本方案旨在进阶翻译中心内集成专门的“变量命名”功能，通过 AI 翻译 + 本地格式化分层逻辑，一键生成大驼峰、小驼峰、下划线、常量等多种风格。

## 2. 用户体验设计 (UX)

### 2.1 界面布局 (基于手绘原型)
当用户选择侧边栏的“变量命名”时，主内容区的结果展示部分从原有的“单一文本框”切换为“多风格并列视图”。

*   **侧边栏 (Sidebar)**:
    1.  `进阶翻译` (默认)
    2.  `变量命名` (新增)
*   **多风格结果区 (Multi-style Results)**:
    *   **大驼峰 (PascalCase)**: [结果文本框] [复制按钮]
    *   **小驼峰 (camelCase)**: [结果文本框] [复制按钮]
    *   **下划线 (snake_case)**: [结果文本框] [复制按钮]
    *   **常量名 (CONSTANT_CASE)**: [结果文本框] [复制按钮]
*   **输入区 (Input Area)**:
    *   **原文 (Source)**: 输入或精修待命名的业务描述。
    *   **提示词 (Prompt)**: 显示并允许微调当前命名的指令。

## 3. 技术实现 (Technical Details)

### 3.1 核心架构
采用“AI 语义理解 + 本地正则转换器”的混合架构。

1.  **AI 层**: 模型接收提示词，将中文业务描述翻译为**最精准的、带空格的英文短语** (例如: `user login service`)。
2.  **本地层 (JavaScript)**: 获取 AI 返回的核心短语，在浏览器端利用正则表达式库将其转换为各种风格。
    *   **PascalCase**: `UserLoginService`
    *   **camelCase**: `userLoginService`
    *   **snake_case**: `user_login_service`
    *   **CONSTANT_CASE**: `USER_LOGIN_SERVICE`
3.  **好处**: 
    - **速度**: 格式转换几乎瞬时完成。
    - **可靠**: 保证命名风格 100% 符合规范，不受 AI 随机性影响。
    - **成本**: 节省多次生成不同风格所需的 Token。

### 3.2 逻辑设计

#### PromptManager 模板
新增一个专门用于变量命名的指令模板：
```
你是一位经验丰富的软件工程师和技术作家。
请将以下中文描述翻译成一个最能体现其含义的英文短语。
要求：用空格分隔单词。只输出结果短语，不要有任何其他解释。

业务描述: [TEXT]
短语:
```

#### NamingFormatter 工具函数
在 `src/utils/text_utils.js` 中新增：
```javascript
function toStyles(phrase) {
  // 1. 去除两端空格，中间多空格合并，非英文字符清理
  const clean = phrase.trim().replace(/[^a-zA-Z\s]/g, '').replace(/\s+/g, ' ');
  const words = clean.split(' ');
  
  return {
    pascal: words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(''),
    camel: words.map((w, index) => index === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(''),
    snake: words.map(w => w.toLowerCase()).join('_'),
    constant: words.map(w => w.toUpperCase()).join('_'),
    kebab: words.map(w => w.toLowerCase()).join('-')
  };
}
```

### 3.3 文件变更清单
- `src/backends/ollama/advanced-panel.html`: 更新 Sidebar 和 Result Area 容器结构。
- `src/backends/ollama/advanced-renderer.js`: 实现任务切换逻辑 (Task Selection) 和样式动态渲染。
- `src/backends/ollama/prompt-manager.js`: 增加命名任务专用的核心 Prompt。
- `src/utils/text_utils.js`: 集成 `toStyles` 格式化逻辑。

## 4. 关键交互 (Interaction)
1.  **进入**: 用户通过超级面板或斜线命令打开进阶翻译中心。
2.  **切换**: 点击侧边栏“变量命名”。
3.  **刷新**: `advanced-renderer.js` 检测到任务变更，隐藏 `result-pane-standard`，显示 `result-pane-multi-style`。
4.  **执行**: 调用 `ollama.generate`。
5.  **回填**: AI 返回结果后，立即触发 `toStyles` 并将各风格版本填充到对应的 Input 中。

## 5. 验收标准
1.  输入“用户登录获取令牌”，AI 应返回核心短语（如 `user login get token`）。
2.  界面同时展示 `UserLoginGetToken`, `userLoginGetToken`, `user_login_get_token`, `USER_LOGIN_GET_TOKEN`。
3.  点击任意行右侧的“复制”，文本剪贴板应包含且仅包含该名命。

## 6. 单元测试
*   **NamingFormatter 测试**: 验证包含数字、多空格、特殊符号时各形式转换的稳定性。
*   **UI 切换测试**: 验证任务切换后，原有的翻译内容不会错误地带入新的结果框。
