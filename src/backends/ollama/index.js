const path = require('path');
const http = require('http');
const https = require('https');
const { OllamaConfig } = require('./config');
const { PromptManager } = require('./prompt-manager');
const targetLanguageDetector = require('../../utils/target_language_detector');


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
        this.promptManager = new PromptManager();
        this.detector = targetLanguageDetector;
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
     * 极速检查后端是否已基本配置就绪（至少选择了模型）
     * @returns {boolean}
     */
    isConfigured() {
        return !!(this.config && this.config.model);
    }

    /**
     * @param {string} text - 待翻译的原文本
     * @param {string} targetOverride - 目标语言设置 (auto 或 具体代码)
     * @param {function} callback - 完成回调 function(err, result)
     * @param {function} progressCallback - 进度回调 (用于展示查词状态)
     */
    queryWord(text, targetOverride, callback, progressCallback = null) {
        const queryId = Math.random().toString(36).substring(7);
        console.log(`[OllamaBackend][${queryId}] queryWord started for:`, text.substring(0, 10));

        // 强制进入下一个事件循环，确保 UI 线程能优先渲染加载中的 Loading 列表项
        setTimeout(async () => {
            console.log(`[OllamaBackend][${queryId}] Entering async block`);
            if (typeof progressCallback === 'function') {
                progressCallback('正在连接 Ollama 并准备翻译...');
            }

            // 再次确认配置已加载
            if (!this.config || !this.config.model) {
                this.reloadConfig();
            }

            if (!this.config.model) {
                return callback(null, {
                    found: false,
                    message: 'Ollama 模型名称未配置。请在配置页中选择或输入模型名称。'
                });
            }

            // 语种决策：由后端根据 globalTarget (targetOverride) 决定
            let finalTarget = targetOverride;
            if (!targetOverride || targetOverride === 'auto') {
                const suggestion = this.detector.detect(text);
                finalTarget = suggestion.target;
            }

            // 构造稳健的翻译 Prompt
            const fullPrompt = this.promptManager.getPrompt('advanced', {
                text: text,
                targetLangCode: finalTarget,
                prompt: this.config.prompt // 注入用户自定义 Prompt
            });

            try {
                const data = await this.fetchChat({
                    messages: [
                        { role: 'user', content: fullPrompt }
                    ],
                    temperature: this.config.temperature
                });

                if (this.workerStopping) {
                    this.workerStopping = false;
                    return;
                }

                if (data.choices && data.choices.length > 0 && data.choices[0].message) {
                    const translation = data.choices[0].message.content.trim();
                    callback(null, {
                        found: true,
                        translation: translation,
                        phonetic: ''
                    });
                } else {
                    callback(null, {
                        found: false,
                        message: 'Ollama 接口未返回有效翻译内容。'
                    });
                }
            } catch (err) {
                if (err.name === 'AbortError') return;
                
                let errorMsg = `API 请求失败: ${err.message}`;
                if (err.message.includes('fetch') || err.message.includes('ECONNREFUSED')) {
                    errorMsg = `无法连接到 Ollama 服务 (${this.config.apiBase})，请确认 Ollama 已启动。`;
                }
                
                callback(null, {
                    found: false,
                    message: errorMsg
                });
            }
        }, 0);
    }

    /**
     * 极速预检模型是否具备视觉能力 (Vision/Projector)
     * @returns {Promise<{supported: boolean, message: string}>}
     */
    async checkVisionCapability() {
        try {
            const modelName = this.config.visionModel || this.config.model;
            if (!modelName) return { supported: false, message: '请在配置页先选择模型' };
            const baseUrl = (this.config.apiBase || '').trim().replace(/\/+$/, '').replace(/\/v1$/, '');
            const endpoint = `${baseUrl}/api/show`;
            const res = await this._request(endpoint, {
                method: 'POST',
                body: JSON.stringify({ name: modelName })
            });

            // 尽力探测逻辑：如果 api/show 接口不存在（例如混元、DeepSeek），则不拦截。
            if (!res.ok) {
                // 如果是 404 或 500，且是远程服务，假定可能支持视觉（交给服务端报错）
                if (res.status === 404 || res.status === 500) {
                   return { supported: true, message: '多模态识图：由于是远程服务，已跳过能力检查' };
                }
                return { supported: false, message: `无法查询模型元数据 (HTTP ${res.status})` };
            }
            
            const data = await res.json();
            // 在 Ollama /api/show 返回中，具备 projector 代表具备视觉。
            const isVision = !!(data.projector || (data.model_info && JSON.stringify(data.model_info).includes('vision')));
            return { supported: isVision, message: isVision ? '模型支持视觉识图' : '当前模型不支持图片识别，请改用 llava 等模型' };
        } catch (e) {
            // 如果请求完全失败且是远程地址，采取宽容放行策略
            if (this.config.apiBase && !this.config.apiBase.includes('localhost') && !this.config.apiBase.includes('127.0.0.1')) {
                return { supported: true, message: '无法连接管理接口进行预检，已进入宽容放行模式' };
            }
            return { supported: false, message: '无法连接到 Ollama 服务进行能力检测' };
        }
    }

    /**
     * 多模态图片识别与翻译
     * @param {string} imageData - 图片的 DataURL (Base64)
     * @param {string} targetOverride - 目标语言设置
     * @param {function} callback - (err, result)
     * @param {function} progressCallback - 进度更新
     */
    queryImage(imageData, targetOverride, callback, progressCallback = null) {
        const queryId = Math.random().toString(36).substring(7);
        console.log(`[OllamaBackend][${queryId}] queryImage started`);

        setTimeout(async () => {
            if (typeof progressCallback === 'function') {
                progressCallback('正在读取图片并连接 Ollama...');
            }

            if (!this.config || !this.config.model) {
                this.reloadConfig();
            }

            let finalTarget = targetOverride;
            if (!targetOverride || targetOverride === 'auto') {
                // 目前图片翻译默认使用目标语种建议（vision prompt 内部会再次尝试判定）
                finalTarget = 'zh'; 
            }

            const visionPrompt = this.promptManager.getPrompt('vision', { 
                targetLangCode: finalTarget 
            });

            try {
                // 确保图片数据包含正确的 Data URL 前缀（适配 OpenAI 兼容接口规范）
                const finalImageUrl = imageData.startsWith('data:') ? imageData : `data:image/png;base64,${imageData}`;

                // 构造 OpenAI 兼容的高级多模态 Content 结构
                const data = await this.fetchChat({
                    model: this.config.visionModel || this.config.model,
                    messages: [
                        {
                            role: 'user',
                            content: [
                                { type: 'text', text: visionPrompt },
                                { type: 'image_url', image_url: { url: finalImageUrl } }
                            ]
                        }
                    ],
                    temperature: this.config.temperature
                });

                if (this.workerStopping) {
                    this.workerStopping = false;
                    return;
                }

                if (data.choices && data.choices.length > 0 && data.choices[0].message) {
                    const rawContent = data.choices[0].message.content;
                    // 解析结构化输出: SOURCE: ... TARGET: ...
                    let ocrText = '';
                    let translation = '';
                    
                    const sourceMatch = rawContent.match(/SOURCE:([\s\S]*?)TARGET:/i);
                    const targetMatch = rawContent.match(/TARGET:([\s\S]*)$/i);
                    
                    if (sourceMatch && targetMatch) {
                        ocrText = sourceMatch[1].trim();
                        translation = targetMatch[1].trim();
                    } else {
                        // 兜底处理：如果模型未按格式输出，则全量作为译文，暂存原文为空
                        translation = rawContent.trim();
                    }

                    callback(null, {
                        found: true,
                        translation: translation,
                        ocrText: ocrText,
                        phonetic: ''
                    });
                } else {
                    callback(null, {
                        found: false,
                        message: '模型未能识别出图片中的文字或未返回结果。'
                    });
                }
            } catch (err) {
                if (err.name === 'AbortError') return;
                console.error(`[OllamaBackend][${queryId}] Error:`, err);
                callback(null, {
                    found: false,
                    message: `图片解析失败: ${err.message} (请检查模型是否支持视觉能力)`
                });
            }
        }, 0);
    }

    /**
     * 底层通用对话接口 (对接 OpenAI 兼容格式)
     * @param {Object} payload 
     * @returns {Promise<Object>}
     */
    async fetchChat(payload) {
        const model = payload.model || this.config.model;
        const messages = payload.messages || [];
        const temperature = payload.temperature !== undefined ? payload.temperature : this.config.temperature;
        const stream = payload.stream || false;

        const requestPayload = {
            model,
            messages,
            temperature,
            stream
        };

        const fetchOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config.apiKey}`
            },
            body: JSON.stringify(requestPayload)
        };

        if (typeof AbortController !== 'undefined') {
            this.currentAbortController = new AbortController();
            fetchOptions.signal = this.currentAbortController.signal;
        }

        let apiBase = (this.config.apiBase || '').trim().replace(/\/+$/, '');
        if (apiBase && !apiBase.endsWith('/v1')) {
            apiBase += '/v1';
        }
        const endpoint = `${apiBase}/chat/completions`;

        const res = await (this.config.useProxy ? fetch(endpoint, fetchOptions) : this._request(endpoint, fetchOptions));
        
        if (!res.ok) {
            const errorObj = await res.json().catch(() => ({}));
            // 优先提取 OpenAI 格式的错误消息，否则使用 HTTP 状态
            const msg = errorObj.error?.message || errorObj.message || `HTTP ${res.status}`;
            throw new Error(msg);
        }

        return res.json();
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
                    // 统一使用 OpenAI 标准的 /v1/models 接口获取列表 (Ollama 亦支持)
                    // 注意：如果 baseUrl 结尾包含 /v1，此处拼接需处理
                    let apiBase = baseUrl.trim().replace(/\/+$/, '');
                    if (!apiBase.endsWith('/v1')) {
                        apiBase += '/v1';
                    }
                    const endpoint = `${apiBase}/models`;

                    const res = await this._request(endpoint, {
                        headers: { 'Authorization': `Bearer ${apiKey}` }
                    });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const data = await res.json();

                    // 规范化解析流程：OpenAI 返回的是 { data: [...] }，数据数组中每一项是 { id: '...' }
                    let modelList = [];
                    if (data.data && Array.isArray(data.data)) {
                        modelList = data.data.map(m => m.id);
                    } else if (data.models && Array.isArray(data.models)) {
                        // 兼容某些老旧或非标题返回模式
                        modelList = data.models.map(m => m.name || m.id);
                    }

                    return { success: true, models: modelList };
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
