const { createDictBackend } = require('../backends/dict/index.js');
const { createOllamaBackend } = require('../backends/ollama/index.js');
const { createLibreTranslateBackend } = require('../backends/libretranslate/index.js');
const { appConfig } = require('../utils/app_config');
const { coreService } = require('./core_service');

class BackendManager {
  constructor() {
    this.activeBackend = null;
    this.currentConfig = null;
    this._proxyListenerAdded = false;
  }

  /**
   * 初始化活跃被选中的后端
   * @param {Object} config - 包含后端的配置信息
   */
  init(config) {
    // 强制清理遗留的 UI，确保后端切换时界面不会重叠
    this.closeCurrentConfigPanel();
    
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
          this.reload(updatedConfig);
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
    if (this.currentConfig.backends.libretranslate) return 'LibreTranslate 查询时延';
    if (this.currentConfig.backends.ollama) return 'Ollama 查询时延';
    return '词典查询时延';
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
   * 重载后端（通常在配置发生改变时被调用）
   * @param {Object} newConfig - 新的环境配置
   */
  reload(newConfig) {
    this._stopCurrentWorker();
    this.init(newConfig);
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
   * 关闭当前加载的设置面板（如果有）
   * @param {boolean} isSilent 是否静默关闭（例如在搜索触发时，不需要重置高度或归还焦点）
   */
  closeCurrentConfigPanel(isSilent = false) {
    // 1. 关闭后端相关的配置面板
    if (this.activeBackend && typeof this.activeBackend.closePanel === 'function') {
      this.activeBackend.closePanel(isSilent);
    }
    
    // 2. 强力清理
    const containerIds = ['ollama-config-container', 'dict-config-container', 'proxy-config-container'];
    containerIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });

    // 3. 清理全局 API 钩子
    delete window._ollamaAPI;
    delete window._dictAPI;
    
    // 4. 清理旧式钩子
    if (typeof window.hideOllamaConfig === 'function') window.hideOllamaConfig();
    if (typeof window.hideProxyConfig === 'function') window.hideProxyConfig();

    // 5. 这里的 _closeConfigPanel 由外部注入
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
  }
}

// 导出单例以便全局公用同一个实例并维持环境生命周期
module.exports = new BackendManager();
