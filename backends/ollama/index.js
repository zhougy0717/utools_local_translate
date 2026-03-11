/**
 * Ollama API 翻译后端驱动
 * 实现 OpenAI 兼容格式的请求调用
 */
class OllamaBackend {
    constructor(config = {}) {
        // 配置合并，确保有默认值
        this.config = {
            apiBase: config.apiBase || 'http://127.0.0.1:11434/v1',
            apiKey: config.apiKey || 'ollama',
            model: config.model || '',
            prompt: config.prompt || '你是一个专业的翻译助手。请将以下文本翻译为${target_lang}。只输出翻译结果，不要输出任何解释说明。',
            temperature: typeof config.temperature !== 'undefined' ? config.temperature : 0.1
        };
        this.workerStopping = false;
        this.currentAbortController = null;
    }

    /**
     * @param {string} text - 待翻译的原文本
     * @param {string} sourceLang - 源语言代码 (例如 'en')
     * @param {string} targetLang - 目标语言代码 (例如 'zh')
     * @param {function} callback - 完成回调 function(err, result)
     * @param {function} progressCallback - 进度回调 (暂不用)
     */
    queryWord(text, sourceLang, targetLang, callback, progressCallback = null) {
        if (!this.config.model) {
            return callback(null, {
                found: false,
                message: 'Ollama 模型名称未配置。请在配置页中选择或输入模型名称。'
            });
        }

        // 处理目标语言占位符
        let targetLangText = '目标语言';
        if (targetLang === 'zh') targetLangText = '中文';
        else if (targetLang === 'en') targetLangText = '英文';

        const systemPrompt = this.config.prompt.replace(/\$\{target_lang\}/g, targetLangText);

        const payload = {
            model: this.config.model,
            temperature: this.config.temperature,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: text }
            ]
        };

        const fetchOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config.apiKey}`
            },
            body: JSON.stringify(payload)
        };

        // 支持请求中断
        if (typeof AbortController !== 'undefined') {
            this.currentAbortController = new AbortController();
            fetchOptions.signal = this.currentAbortController.signal;
        }

        const endpoint = `${this.config.apiBase}/chat/completions`;

        fetch(endpoint, fetchOptions)
            .then(res => {
                if (!res.ok) {
                    throw new Error(`HTTP 异常状态码: ${res.status}`);
                }
                return res.json();
            })
            .then(data => {
                if (this.workerStopping) {
                    this.workerStopping = false;
                    return; // 被中断
                }

                if (data.choices && data.choices.length > 0 && data.choices[0].message) {
                    const translation = data.choices[0].message.content.trim();
                    callback(null, {
                        found: true,
                        translation: translation,
                        phonetic: '' // LLM 翻译通常不提供音标
                    });
                } else {
                    callback(null, {
                        found: false,
                        message: 'Ollama 接口返回格式异常，未找到翻译内容。'
                    });
                }
            })
            .catch(err => {
                if (err.name === 'AbortError') {
                    // 用户取消请求
                    return;
                }
                
                let errorMsg = `API 请求失败: ${err.message}`;
                if (err.message.includes('fetch') || err.message.includes('Failed to fetch') || err.message.includes('ECONNREFUSED')) {
                    errorMsg = `无法连接到 Ollama 服务 (${this.config.apiBase})，请确认 Ollama 已启动且地址正确。`;
                }
                
                callback(null, {
                    found: false,
                    message: errorMsg
                });
            });
    }

    // 中断翻译请求
    stopWorker() {
        this.workerStopping = true;
        if (this.currentAbortController) {
            this.currentAbortController.abort();
            this.currentAbortController = null;
        }
    }
}

function createOllamaBackend(config) {
    return new OllamaBackend(config);
}

module.exports = {
    OllamaBackend,
    createOllamaBackend
};
