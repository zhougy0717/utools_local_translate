/**
 * Prompt 管理器
 * 负责管理 AI 任务的提示词模板及动态生成逻辑
 */
class PromptManager {
  constructor() {
    this.templates = {
      advanced: "你是一位专业的翻译官和语言学家。请根据语境，将以下文本准确且自然地翻译成 [TARGET_LANG]。\n\n注意：请只返回翻译后的结果文字，不要包含任何额外的解释、引言、说明或 meta 信息（如 \"这是翻译：\"）。只输出结果，严禁解释。\n\n目标语言：[TARGET_LANG]\n待翻译文本：[TEXT]",
      naming: `你是一位精通多种编程语言的资深架构师和代码规范专家。
你的任务是将中文业务描述转换为最符合编程规范的英文变量/函数命名短语。

### 核心任务：
**语义提取**：无论输入多么复杂，你**必须**先提取其最核心的意图。
- ❌ 错误做法：字面直译（如：if member active grant discount）。
- ✅ 正确做法：提取核心动宾（如：apply discount）。

### 规则：
1. **合法性**：命名的第一个单词**严禁以数字或任何非字母符号开头**（如 1, _, $, #）。
2. **极致精简**：优先使用行业缩写，理想长度在 5-15 字符，**绝对禁止超过 20 字符**。
3. **结构**：
   - 动作类：采用“动词+名词”结构（如：fetch user, update cfg）。
   - 实体类：采用名词短语结构（如：user profile, api key）。

### 输出指令：
- **必须给出 5 个** 不同的候选建议，每个建议语房间用 **|** 符号分隔（如：phrase one | phrase two | phrase three）。
- **只输出**短语结果，严禁输出任何解释、序号、总结或非英文字符（除了分隔符 |）。

待处理业务描述: [TEXT]
候选名称短语 (用 | 分隔): `
    };
  }

  /**
   * 获取默认模板 (进阶翻译)
   * @returns {string}
   */
  getDefaultTemplate() {
    return this.templates.advanced;
  }

  /**
   * 基于模板并替换变量
   * @param {string} template 
   * @param {{text: string, targetLang: string}} context 
   * @returns {string}
   */
  buildPrompt(template, context) {
    if (!template) return '';
    let result = template;
    
    if (context.targetLang) {
      result = result.replace(/\[TARGET_LANG\]/g, context.targetLang);
    }
    
    if (context.text) {
      result = result.replace(/\[TEXT\]/g, context.text);
    }
    
    return result;
  }
}

module.exports = {
  PromptManager
};
