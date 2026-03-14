/**
 * LibreTranslate API 翻译后端驱动
 */
class LibreTranslateBackend {
    constructor(config = {}) {
        this.config = {
            apiBase: config.apiBase || '',
            apiKey: config.apiKey || ''
        };
        this.currentAbortController = null;
    }

    /**
     * @param {string} text - 待翻译的原文本
     * @param {string} sourceLang - 源语言代码 (例如 'en')
     * @param {string} targetLang - 目标语言代码 (例如 'zh')
     * @param {function} callback - 完成回调 function(err, result)
     * @param {function} progressCallback - 进度回调 (不使用)
     */
    queryWord(text, sourceLang, targetLang, callback, progressCallback = null) {
        if (!this.config.apiBase) {
            return callback(null, {
                found: false,
                message: 'LibreTranslate 服务器地址未配置。请输入 /libre <url> 进行配置。'
            });
        }

        const payload = {
            q: text,
            source: sourceLang,
            target: targetLang,
            format: 'text',
            api_key: this.config.apiKey
        };

        const fetchOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        };

        if (typeof AbortController !== 'undefined') {
            this.currentAbortController = new AbortController();
            fetchOptions.signal = this.currentAbortController.signal;
        }

        const endpoint = `${this.config.apiBase.replace(/\/+$/, '')}/translate`;

        fetch(endpoint, fetchOptions)
            .then(res => {
                if (!res.ok) {
                    if (res.status === 403) {
                        throw new Error('API Key 无效或权限不足 (403)');
                    }
                    throw new Error(`HTTP 异常状态码: ${res.status}`);
                }
                return res.json();
            })
            .then(data => {
                if (data && data.translatedText) {
                    callback(null, {
                        found: true,
                        translation: data.translatedText.trim(),
                        phonetic: ''
                    });
                } else {
                    callback(null, {
                        found: false,
                        message: 'LibreTranslate 接口返回格式异常，未找到翻译内容。'
                    });
                }
            })
            .catch(err => {
                if (err.name === 'AbortError') return;

                let errorMsg = `API 请求失败: ${err.message}`;
                if (err.message.includes('fetch') || err.message.includes('Failed to fetch') || err.message.includes('ECONNREFUSED')) {
                    errorMsg = `无法连接到 LibreTranslate 服务 (${this.config.apiBase})，请确认地址正确且服务器已启动。`;
                }

                callback(null, {
                    found: false,
                    message: errorMsg
                });
            });
    }

    stopWorker() {
        if (this.currentAbortController) {
            this.currentAbortController.abort();
            this.currentAbortController = null;
        }
    }
}

function createLibreTranslateBackend(config) {
    return new LibreTranslateBackend(config);
}

module.exports = {
    LibreTranslateBackend,
    createLibreTranslateBackend
};
