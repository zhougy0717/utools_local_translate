/**
 * Prompt 管理器
 * 负责管理 AI 任务的提示词模板及动态生成逻辑
 */
class PromptManager {
  constructor() {
    this.templates = {
      advanced: "你是一位专业的翻译官和语言学家。请根据语境，将以下文本准确且自然地翻译成 [TARGET_LANG]。\n\n注意：请只返回翻译后的结果文字，不要包含任何额外的解释、引言、说明或 meta 信息（如 \"这是翻译：\"）。只输出结果，严禁解释。\n\n目标语言：[TARGET_LANG]\n待翻译文本：[TEXT]"
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
