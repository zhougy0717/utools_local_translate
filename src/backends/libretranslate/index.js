const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const { LibreTranslateConfig } = require('./config');
const targetLanguageDetector = require('../../utils/target_language_detector');
const { appConfig } = require('../../utils/app_config');

/**
 * LibreTranslate API 翻译后端驱动
 */
class LibreTranslateBackend {
    constructor(config = {}) {
        // 优先使用传入的配置，否则从存储加载
        if (config instanceof LibreTranslateConfig) {
            this.configManager = config;
            this.config = config.load();
        } else {
            this.configManager = new LibreTranslateConfig();
            this.config = Object.assign({}, this.configManager.load(), config);
        }
        this.currentAbortController = null;
        this.detector = targetLanguageDetector;
    }

    /**
     * 获取配置管理器
     * @returns {LibreTranslateConfig}
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
     * @param {string} targetOverride - 目标语言设置 (auto 或 具体代码)
     * @param {function} callback - 完成回调 function(err, result)
     * @param {function} progressCallback - 进度回调 (不使用)
     */
    queryWord(text, targetOverride, callback, progressCallback = null) {
        // 语种决策：由探测器决定源语种，由探测器建议或全局设置决定目标语种
        const suggestion = this.detector.detect(text);
        const sLang = suggestion.source;
        const tLang = (targetOverride && targetOverride !== 'auto') ? targetOverride : suggestion.target;

        // 使用配置的地址或默认本地地址
        const apiBase = this.config.apiBase || 'http://127.0.0.1:5000';

        const payload = {
            q: text,
            source: sLang,
            target: tLang,
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

        const endpoint = `${apiBase.replace(/\/+$/, '')}/translate`;

        this._directRequest(endpoint, fetchOptions)
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
                    errorMsg = `无法连接到 LibreTranslate 服务 (${apiBase})，请确认地址正确且服务器已启动。`;
                }

                callback(null, {
                    found: false,
                    message: errorMsg
                });
            });
    }

    // 发起不经过代理的直接请求
    _directRequest(url, options) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const protocol = urlObj.protocol === 'https:' ? https : http;
            
            const sslVerify = this.config.sslVerify !== undefined ? !!this.config.sslVerify : true;

            const reqOptions = {
                method: options.method || 'GET',
                headers: options.headers || {},
                signal: options.signal
            };

            if (protocol === https) {
                const { getSystemCerts } = require('../../utils/system_ca');
                reqOptions.rejectUnauthorized = sslVerify;
                reqOptions.ca = getSystemCerts();
            }

            const req = protocol.request(url, reqOptions, (res) => {
                let data = '';
                res.setEncoding('utf8');
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    resolve({
                        ok: res.statusCode >= 200 && res.statusCode < 300,
                        status: res.statusCode,
                        json: async () => JSON.parse(data),
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
        });
    }

    stopWorker() {
        if (this.currentAbortController) {
            this.currentAbortController.abort();
            this.currentAbortController = null;
        }
    }

    /**
     * 打开后端配置面板
     * @param {function} onCloseCallback 
     */
    openConfigPanel(onCloseCallback) {
        if (typeof utools === 'undefined') return;

        const containerId = 'libretranslate-config-container';
        const existing = document.getElementById(containerId);
        if (existing) {
            existing.style.display = 'block';
            this.configContainer = existing;
            utools.setExpendHeight(540);
            return;
        }

        const configPath = path.join(__dirname, 'libretranslate-config.html');
        let htmlContent = fs.readFileSync(configPath, 'utf8');

        // 注入渲染器代码
        const rendererPath = path.join(__dirname, 'libretranslate-renderer.js');
        const rendererJs = fs.readFileSync(rendererPath, 'utf8');
        htmlContent = htmlContent.replace('<!-- RENDERER_JS -->', `<script>${rendererJs}</script>`);

        // 设置面板并注入桥接 API
        utools.setExpendHeight(540);

        const container = document.createElement('div');
        container.id = containerId;
        container.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; z-index:999; background:#fff;';
        
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'width:100%; height:100%; border:none;';
        container.appendChild(iframe);
        document.body.appendChild(container);

        iframe.contentWindow.document.open();
        iframe.contentWindow.document.write(htmlContent);
        iframe.contentWindow.document.close();

        // 注入桥接 API
        iframe.contentWindow._libreAPI = {
            loadConfig: () => {
                return this.configManager.load();
            },
            saveConfig: (newConfig) => {
                this.configManager.save(newConfig);
                this.reloadConfig();
                return { success: true };
            },
            testConnection: async (apiBase, apiKey) => {
                try {
                    const endpoint = `${apiBase.replace(/\/+$/, '')}/languages`;
                    const res = await this._directRequest(endpoint, { method: 'GET' });
                    if (res.ok) {
                        const langs = await res.json();
                        return { success: true, languages: langs };
                    }
                    return { success: false, message: `HTTP ${res.status}` };
                } catch (e) {
                    return { success: false, message: e.message };
                }
            },
            closePanel: () => {
                this.closePanel();
                if (onCloseCallback) onCloseCallback();
            },
            // 打开全局代理设置（来源为 'libretranslate'，代理页面将据此显示返回按钮）
            openProxyConfig: () => {
                const { coreService } = require('../../core/core_service');
                const proxyService = coreService.getProxyService();
                if (proxyService) proxyService.openPanel('libretranslate');
            }
        };

        this.configContainer = container;
    }

    /**
     * 关闭配置面板
     * @param {boolean} isSilent 
     */
    closePanel(isSilent = false) {
        if (this.configContainer) {
            this.configContainer.remove();
            this.configContainer = null;
        }
        const container = document.getElementById('libretranslate-config-container');
        if (container) container.remove();
        
        if (!isSilent && typeof utools !== 'undefined') {
            utools.setExpendHeight(0);
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
