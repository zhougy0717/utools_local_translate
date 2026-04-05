const { createDictBackend } = require('../backends/dict/index.js');
const { createOllamaBackend } = require('../backends/ollama/index.js');
const { createLibreTranslateBackend } = require('../backends/libretranslate/index.js');

const { appConfig } = require('../utils/app_config');

class BackendManager {
  constructor() {
    this.activeBackend = null;
    this.currentConfig = null;
  }

  /**
   * 初始化活跃被选中的后端
   * @param {Object} config - 包含后端的配置信息
   */
  init(config) {
    this.currentConfig = config;

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

  _stopCurrentWorker() {
    if (this.activeBackend && typeof this.activeBackend.stopWorker === 'function') {
      this.activeBackend.stopWorker();
    }
  }
}

// 导出单例以便全局公用同一个实例并维持环境生命周期
module.exports = new BackendManager();
