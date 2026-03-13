const { createDictBackend } = require('../../backends/dict/index.js');
const { createHelsinkiBackend } = require('../../backends/helsinki/helsinki.js');
const { createOllamaBackend } = require('../../backends/ollama/index.js');

class BackendManager {
  constructor() {
    this.activeBackend = null;
    this.currentConfig = null;
  }

  /**
   * 初始化活跃被选中的后端
   * @param {Object} appConfig - 包含后端的配置信息
   */
  init(appConfig) {
    this.currentConfig = appConfig;

    // 应用代理设置
    if (appConfig.proxy) {
      console.log(`[BackendManager] Applying proxy: ${appConfig.proxy}`);
      process.env.HTTP_PROXY = appConfig.proxy;
      process.env.HTTPS_PROXY = appConfig.proxy;
    } else {
      delete process.env.HTTP_PROXY;
      delete process.env.HTTPS_PROXY;
    }

    if (!appConfig.backends) {
       appConfig.backends = { offline_dict: true }; // 降级处理
    }
    if (appConfig.backends.ollama) {
      this.activeBackend = createOllamaBackend(appConfig.ollama);
    } else if (appConfig.backends.helsinki_model) {
      this.activeBackend = createHelsinkiBackend({ modelRepoPath: appConfig.resourcePath });
    } else {
      this.activeBackend = createDictBackend({ dictRepoPath: appConfig.resourcePath });
    }
  }

  /**
   * 获取当前后端的加载信息
   * @returns {string} 加载提示
   */
  getLoadingMessage() {
    if (this.currentConfig.backends.ollama) {
      return '正在请求 Ollama 服务，请稍候...';
    } else if (this.currentConfig.backends.helsinki_model) {
      return '调用本地大模型，可能需要数秒钟，请稍候...';
    }
    return '正在检索本地词典，请稍候...';
  }

  /**
   * 获取当前后端用于显示时延统计的名字
   * @returns {string}
   */
  getBackendName() {
    if (this.currentConfig.backends.ollama) return 'Ollama 查询时延';
    if (this.currentConfig.backends.helsinki_model) return '模型查询时延';
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
   * 打开 Ollama 设置面板（即使当前未激活 Ollama 后端）
   * @param {Function} onCloseCallback 
   */
  openOllamaConfig(onCloseCallback) {
    const tempOllama = createOllamaBackend(this.currentConfig.ollama);
    tempOllama.openConfigPanel(onCloseCallback);
  }

  _stopCurrentWorker() {
    if (this.activeBackend && typeof this.activeBackend.stopWorker === 'function') {
      this.activeBackend.stopWorker();
    }
  }
}

// 导出单例以便全局公用同一个实例并维持环境生命周期
module.exports = new BackendManager();
