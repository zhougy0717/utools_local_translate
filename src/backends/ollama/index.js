const path = require('path');
const http = require('http');
const https = require('https');
const { OllamaConfig } = require('./config');

/**
 * Ollama API 翻译后端驱动
 * 实现 OpenAI 兼容格式的请求调用
 */
class OllamaBackend {
    constructor(config = {}) {
        // 优先使用传入的配置，否则从存储加载
        if (config instanceof OllamaConfig) {
            this.configManager = config;
            this.config = config.load();
        } else {
            this.configManager = new OllamaConfig();
            this.config = Object.assign({}, this.configManager.load(), config);
        }
        this.workerStopping = false;
        this.currentAbortController = null;
    }

    /**
     * 获取配置管理器
     * @returns {OllamaConfig}
     */
    getConfigManager() {
        return this.configManager;
    }

    /**
     * 重新加载配置
     */
    reloadConfig() {
        this.configManager.clearCache();
        this.config = this.configManager.load();
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
            stream: false,
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

        let apiBase = (this.config.apiBase || '').trim().replace(/\/+$/, '');
        if (apiBase && !apiBase.endsWith('/v1')) {
            apiBase += '/v1';
        }
        const endpoint = `${apiBase}/chat/completions`;

        // 根据 useProxy 决定请求方式：true 则使用全局（由系统代理或 fetch 自动处理），false 则强制直连
        const requestPromise = this.config.useProxy 
            ? fetch(endpoint, fetchOptions)
            : this._request(endpoint, fetchOptions);

        requestPromise
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

    /**
     * 发起基础网络请求 (如果 options 包含强制直连逻辑则跳过系统代理)
     */
    _request(url, options) {
        return new Promise((resolve, reject) => {
            try {
                const urlObj = new URL(url);
                const protocol = urlObj.protocol === 'https:' ? https : http;
                
                const headers = Object.assign({}, options.headers || {});
                if (options.body) {
                    headers['Content-Length'] = Buffer.byteLength(options.body);
                }

                const reqOptions = {
                    method: options.method || 'GET',
                    headers: headers,
                    signal: options.signal
                };

                const req = protocol.request(url, reqOptions, (res) => {
                    let dataArray = [];
                    res.on('data', (chunk) => {
                        dataArray.push(chunk);
                    });
                    res.on('end', () => {
                        const buffer = Buffer.concat(dataArray);
                        const data = buffer.toString('utf8');
                        resolve({
                            ok: res.statusCode >= 200 && res.statusCode < 300,
                            status: res.statusCode,
                            json: async () => {
                                try {
                                    return JSON.parse(data);
                                } catch (e) {
                                    throw new Error('解析响应 JSON 失败: ' + data.substring(0, 50));
                                }
                            },
                            text: async () => data
                        });
                    });
                });

                req.on('error', (err) => {
                    reject(err);
                });

                if (options.body) {
                    req.write(options.body);
                }
                req.end();
            } catch (e) {
                reject(e);
            }
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

    /**
     * 销毁配置界面（清理容器并解绑 API）
     */
    closePanel(isSilent = false) {
        console.log('[Ollama] Closing config panel, silent:', isSilent);
        const container = document.getElementById('ollama-config-container');
        if (container) {
            if (container.parentNode) {
                container.parentNode.removeChild(container);
            }
            if (!isSilent) {
                if (typeof utools !== 'undefined') {
                    utools.setExpendHeight(0);
                }
            }
        }
        
        delete window._ollamaAPI;
        delete window.hideOllamaConfig;
        
        if (typeof this._onPanelClose === 'function') {
            const callback = this._onPanelClose;
            this._onPanelClose = null;
            if (!isSilent) callback();
        }
    }

    /**
     * 挂载并打开自身的 Ollama 配置界面
     * @param {Function} onCloseCallback 面板关闭后的回调
     */
    openConfigPanel(onCloseCallback) {
        if (typeof document === 'undefined') return;

        this._onPanelClose = onCloseCallback;
        if (typeof utools !== 'undefined') utools.setExpendHeight(600);

        // 注入 Bridge API 以供 iframe 调用内容（解耦持久化逻辑）
        window._ollamaAPI = {
            // 加载配置（此时包含模型列表等缓存）
            loadConfig: () => {
                const config = this.configManager.load();
                // 也要读取全局代理状态供显示
                const globalProxy = (typeof utools !== 'undefined' ? utools.dbStorage.getItem('app_config') : null)?.proxy || { enabled: false };
                return { 
                    ...config,
                    globalProxyStatus: globalProxy.enabled,
                    globalProxyAddr: `${globalProxy.host}:${globalProxy.port}`
                };
            },
            // 保存配置
            saveConfig: (newConfig) => {
                this.configManager.save(newConfig);
                this.reloadConfig();
                return true;
            },
            // 测试连接与模型列表获取
            testConnection: async (baseUrl, apiKey) => {
                try {
                    // Ollama 的模型列表接口是 /api/tags
                    const endpoint = `${baseUrl}/api/tags`;
                    const res = await this._request(endpoint, {
                        headers: { 'Authorization': `Bearer ${apiKey}` }
                    });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const data = await res.json();
                    return { success: true, models: (data.models || []).map(m => m.name) };
                } catch (e) {
                    return { success: false, error: e.message };
                }
            },
            // 关闭面板
            closePanel: () => this.closePanel(),
            // 打开全局代理设置
            openGlobalProxyConfig: () => {
                const { coreService } = require('../../core/core_service');
                const proxyService = coreService.getProxyService();
                if (proxyService) proxyService.openPanel();
            }
        };

        // 兼容旧逻辑钩子，确保处理正常
        window.hideOllamaConfig = () => this.closePanel();

        let iframeContainer = document.getElementById('ollama-config-container');
        if (!iframeContainer) {
            iframeContainer = document.createElement('div');
            iframeContainer.id = 'ollama-config-container';
            Object.assign(iframeContainer.style, {
                position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
                zIndex: '999999', backgroundColor: '#f7f8f9'
            });
            
            const iframe = document.createElement('iframe');
            const htmlPath = path.resolve(__dirname, 'ollama-prompt-config.html');
            iframe.src = 'file://' + htmlPath.replace(/\\/g, '/');
            Object.assign(iframe.style, { width: '100%', height: '100%', border: 'none', display: 'block' });
            
            iframeContainer.appendChild(iframe);
            document.body.appendChild(iframeContainer);
        }
        iframeContainer.style.display = 'block';
    }
}

function createOllamaBackend(config) {
    return new OllamaBackend(config);
}

module.exports = {
    OllamaBackend,
    createOllamaBackend
};
