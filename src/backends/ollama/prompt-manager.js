const { getNameByCode } = require('../../commands/languages');

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
    候选名称短语 (用 | 分隔): `,
      vision: "参考图中显示的图片内容 [img-0]，你是一位专业的 OCR 和翻译专家。请将图中的内容翻译为 [TARGET_LANG]。\n\n请按以下结构输出：\n\nSOURCE:\n(识别出的原文)\n\nTARGET:\n(根据上述逻辑生成的 [TARGET_LANG] 译文)\n\n注意：严禁包含任何额外的解释或引言。只输出 SOURCE 和 TARGET 两个区块的内容。"
    };
  }

  /**
   * 基于任务类型获取并构建 Prompt
   * @param {string} taskType - advanced | naming | vision
   * @param {Object} context - { text, targetLangCode, customPrompt }
   */
  getPrompt(taskType, context) {
    const customPrompt = context.customPrompt || context.prompt;
    let template = customPrompt || this.templates.advanced;
    
    if (taskType === 'naming') template = this.templates.naming;
    else if (taskType === 'vision') {
        // vision 任务暂不支持自定义 Prompt 覆盖，使用专用模板
        template = this.templates.vision;
    }
    
    // 动态获取语言名称
    const targetCode = context.targetLangCode || context.targetLang;
    const targetLangName = getNameByCode(targetCode);

    return this.buildPrompt(template, {
      text: context.text,
      targetLang: targetLangName
    });
  }

  /**
   * 获取 Prompt 模板 (仅替换语言，保留 [TEXT] 占位符供 UI 使用)
   */
  getPromptTemplate(taskType, targetLangCode, customPrompt) {
    const baseTemplate = customPrompt || (taskType === 'naming' ? this.templates.naming : this.templates.advanced);
    const targetLangName = getNameByCode(targetLangCode);

    return baseTemplate.replace(/\[TARGET_LANG\]/g, targetLangName);
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
    
    // 兼容性替换：同时支持 [TARGET_LANG] 和旧版的 ${target_lang}
    if (context.targetLang) {
      result = result.replace(/\[TARGET_LANG\]/g, context.targetLang);
      result = result.replace(/\$\{target_lang\}/g, context.targetLang);
    }
    
    // 文本替换：同时支持 [TEXT] 和旧版的 ${text}
    let textReplaced = false;
    if (context.text) {
      if (result.includes('[TEXT]') || result.includes('${text}')) {
        result = result.replace(/\[TEXT\]/g, context.text);
        result = result.replace(/\$\{text\}/g, context.text);
        textReplaced = true;
      }
    }
    
    // 鲁棒性保障：如果变量模板中完全没有 [TEXT] 或 ${text} 占位符，
    // 则说明该 Prompt 可能是旧版简单指令，我们需要在末尾追加待翻译文本。
    if (context.text && !textReplaced) {
        result = result.trim() + "\n\n" + context.text;
    }
    
    return result;
  }
}

module.exports = {
  PromptManager
};
