const { createDictBackend } = require('../backends/dict/index.js');
const { createOllamaBackend } = require('../backends/ollama/index.js');
const { createLibreTranslateBackend } = require('../backends/libretranslate/index.js');
const { AdvancedPanelService } = require('../backends/ollama/advanced-service');
const { appConfig } = require('../utils/app_config');
const { coreService } = require('./core_service');

class BackendManager {
  constructor() {
    this.activeBackend = null;
    this.currentConfig = null;
    this._proxyListenerAdded = false;
    this.advancedPanelService = new AdvancedPanelService();
    this._dedicatedOllamaBackend = null;
  }

  /**
   * 初始化活跃被选中的后端
   * @param {Object} config - 包含后端的配置信息
   * @param {boolean} skipUiCleanup - 是否跳过 UI 清理 (用于静默更新配置而不关闭当前面板)
   */
  init(config, skipUiCleanup = false) {
    // 强制清理遗留的 UI，确保后端切换时界面不会重叠 (静默执行，不触发回调重载)
    if (!skipUiCleanup) {
      this.closeCurrentConfigPanel(true);
    }
    
    this.currentConfig = config;

    // 订阅代理变更事件 (仅注册一次)
    if (!this._proxyListenerAdded) {
      const proxyService = coreService.getProxyService();
      if (proxyService) {
        proxyService.on(proxyService.EVENT_PROXY_CONFIG_CHANGED, () => {
          console.log('[BackendManager] Detected proxy change, triggering auto-reload...');
          // 重新读取配置并重载
          const updatedConfig = Object.assign({}, this.currentConfig, {
            proxy: appConfig.getProxy()
          });
          // 代理变更触发的重载不应关闭当前的配置面板 (如果是从面板中发起的保存)
          this.reload(updatedConfig, true);
        });
        this._proxyListenerAdded = true;
      }
    }

    // 应用代理设置
    const proxyStr = appConfig.getProxy();
    if (proxyStr) {
      console.log(`[BackendManager] Applying proxy: ${proxyStr}`);
      process.env.HTTP_PROXY = proxyStr;
      process.env.HTTPS_PROXY = proxyStr;
    } else {
      delete process.env.HTTP_PROXY;
      delete process.env.HTTPS_PROXY;
    }

    if (!config.backends) {
       config.backends = { offline_dict: true }; // 降级处理
    }
    
    if (config.backends.libretranslate) {
      this.activeBackend = createLibreTranslateBackend(config.libretranslate);
    } else if (config.backends.ollama) {
      this.activeBackend = createOllamaBackend(config.ollama);
    } else {
      this.activeBackend = createDictBackend({ dictRepoPath: config.resourcePath });
    }
  }

  /**
   * 获取当前后端的加载信息
   * @returns {string} 加载提示
   */
  getLoadingMessage() {
    if (this.currentConfig.backends.libretranslate) {
      return '正在请求 LibreTranslate 服务，请稍候...';
    }
    if (this.currentConfig.backends.ollama) {
      return '正在请求 Ollama 服务，请稍候...';
    }
    return '正在检索本地词典，请稍候...';
  }

  /**
   * 获取当前后端用于显示时延统计的名字
   * @returns {string}
   */
  getBackendName() {
    if (this.currentConfig.backends.libretranslate) return 'LibreTranslate';
    if (this.currentConfig.backends.ollama) return 'Ollama';
    return '本地词典';
  }

  /**
   * 委托调用底层引擎进行查词
   * @param {string} word - 单词
   * @param {string} sourceLang - 源语言
   * @param {string} targetLang - 目标语言
   * @param {Function} callback - 查询完成回调 (err, result)
   * @param {Function} progressCallback - 构建进度回调
   */
  queryWord(word, sourceLang, targetLang, callback, progressCallback) {
    if (!this.activeBackend) {
      callback(new Error('Backend not initialized'), null);
      return;
    }
    this.activeBackend.queryWord(word, sourceLang, targetLang, callback, progressCallback);
  }

  /**
   * 委托调用底层引擎进行图片识别与翻译
   * @param {string} imageData - 图片 DataURL/Base64
   * @param {string} targetLang - 目标语言
   * @param {Function} callback - 回调
   * @param {Function} progressCallback - 进度回调
   */
  queryImage(imageData, targetLang, callback, progressCallback) {
    if (!this.activeBackend) {
      callback(new Error('Backend not initialized'), null);
      return;
    }
    if (typeof this.activeBackend.queryImage !== 'function') {
      callback(null, {
        found: false,
        message: `当前后端 (${this.getBackendName()}) 不支持图片识别。请在设置中切换回 Ollama 并确保选用了支持视觉的模型。`
      });
      return;
    }
    this.activeBackend.queryImage(imageData, targetLang, callback, progressCallback);
  }

  /**
   * 重载后端（通常在配置发生改变时被调用）
   * @param {Object} newConfig - 新的环境配置
   * @param {boolean} skipUiCleanup - 是否跳过 UI 清理
   */
  reload(newConfig, skipUiCleanup = false) {
    this._stopCurrentWorker();
    this.init(newConfig, skipUiCleanup);
  }

  /**
   * 从最新的 appConfig 自动加载并重载后端环境
   * @param {boolean} skipUiCleanup - 是否跳过销毁当前 UI
   */
  reloadFromAppConfig(skipUiCleanup = false) {
    console.log('[BackendManager] Reloading from appConfig...');
    appConfig.clearCache();
    const fullConfig = appConfig.load();
    
    // 构造满足后端初始化所需的完整配置对象
    const backendInitConfig = {
      ...fullConfig,
      resourcePath: fullConfig.resourcePath || '',
      proxy: appConfig.getProxy()
    };
    
    this.reload(backendInitConfig, skipUiCleanup);
  }

  /**
   * 停止并清理当前所有的环境和后台逻辑
   */
  stop() {
    this._stopCurrentWorker();
    this.currentConfig = null;
    this.activeBackend = null;
  }

  /**
   * 打开当前激活选项相关的设置面板
   * @param {Function} onCloseCallback 
   */
  openConfigPanel(onCloseCallback) {
    if (this.activeBackend && typeof this.activeBackend.openConfigPanel === 'function') {
      this.activeBackend.openConfigPanel(onCloseCallback);
    } else {
      console.warn('[BackendManager] activeBackend does not support openConfigPanel');
      if (typeof onCloseCallback === 'function') onCloseCallback();
    }
  }

  /**
   * 打开 Ollama 进阶翻译面板
   * @param {string} text - 待处理的原始文本
   * @param {string} targetLangCode - 目标语言代码 ('en', 'zh' 等)
   */
  openAdvancedPanel(text, targetLangCode, initialResult = '', backendName = '') {
    // 方案：如果当前 activeBackend 就是 Ollama，直接复用；否则从配置中创建一个专用实例。
    let targetBackend = null;
    if (this.activeBackend && this.activeBackend.constructor.name === 'OllamaBackend') {
      targetBackend = this.activeBackend;
    } else {
      if (!this._dedicatedOllamaBackend) {
        this._dedicatedOllamaBackend = createOllamaBackend(this.currentConfig.ollama);
      }
      targetBackend = this._dedicatedOllamaBackend;
    }

    this.advancedPanelService.openPanel(text, () => {
      // 面板关闭时的处理（如需要刷新主列表）
    }, targetBackend, targetLangCode, initialResult, backendName);
  }

  /**
   * 关闭当前加载的设置面板（如果有）
   * @param {boolean} isSilent 是否静默关闭（例如在搜索触发时，不需要重置高度或归还焦点）
   */
  closeCurrentConfigPanel(isSilent = false) {
    // 1. 关闭进阶翻译面板
    if (this.advancedPanelService) {
      this.advancedPanelService.closePanel(isSilent);
    }

    // 2. 关闭后端相关的配置面板
    if (this.activeBackend && typeof this.activeBackend.closePanel === 'function') {
      this.activeBackend.closePanel(isSilent);
    }
    
    // 3. 强力清理
    const containerIds = [
      'ollama-config-container', 
      'dict-config-container', 
      'proxy-config-container',
      'ollama-advanced-panel-container'
    ];
    containerIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });

    // 4. 清理全局 API 钩子
    delete window._ollamaAPI;
    delete window._dictAPI;
    delete window._advancedAPI;
    
    // 5. 清理旧式钩子
    if (typeof window.hideOllamaConfig === 'function') window.hideOllamaConfig();
    if (typeof window.hideProxyConfig === 'function') window.hideProxyConfig();

    // 6. 这里的 _closeConfigPanel 由外部注入
    if (typeof window._closeConfigPanel === 'function') {
        const temp = window._closeConfigPanel;
        delete window._closeConfigPanel;
        temp(isSilent);
    }
  }

  _stopCurrentWorker() {
    if (this.activeBackend && typeof this.activeBackend.stopWorker === 'function') {
      this.activeBackend.stopWorker();
    }
    if (this._dedicatedOllamaBackend) {
      this._dedicatedOllamaBackend.stopWorker();
    }
  }
}

// 导出单例以便全局公用同一个实例并维持环境生命周期
module.exports = new BackendManager();
