/**
 * Ollama Backend 配置类
 * 存储键: backend_ollama
 */
const { AbstractBackendConfig } = require('../base/config');

const OLLAMA_DEFAULTS = {
  apiBase: 'http://127.0.0.1:11434/v1',
  apiKey: 'ollama',
  model: '',
  visionModel: '',
  prompt: '你是一个专业的翻译助手。请将以下文本翻译为 [TARGET_LANG]。只输出翻译结果，不要输出任何解释说明。\n\n[TEXT]',
  temperature: 0.1,
  useProxy: false,
  sslVerify: true
};

class OllamaConfig extends AbstractBackendConfig {
  constructor() {
    super('backend_ollama', OLLAMA_DEFAULTS);
  }
}

module.exports = {
  OllamaConfig,
  OLLAMA_DEFAULTS
};
