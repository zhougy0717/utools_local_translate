/**
 * 应用级配置类
 * 存储键: app_config
 * 管理代理、后端选择、显示选项等应用级配置
 */
const { storageAdapter } = require('./storage_adapter');

const APP_CONFIG_DEFAULTS = {
  proxy: '',
  activeBackend: 'offline_dict',
  showTranslationCost: true,
  backends: {
    offline_dict: true,
    ollama: false,
    libretranslate: false
  }
};

class AppConfig {
  constructor() {
    this.storageKey = 'app_config';
    this.defaults = APP_CONFIG_DEFAULTS;
    this._cache = null;
  }

  /**
   * 加载配置（带缓存）
   * @returns {Object} 合并后的配置
   */
  load() {
    if (this._cache !== null) {
      return this._cache;
    }

    const stored = storageAdapter.getItem(this.storageKey);
    if (stored) {
      this._cache = this._mergeDefaults(stored);
    } else {
      this._cache = Object.assign({}, this.defaults);
    }
    return this._cache;
  }

  /**
   * 深度合并默认配置
   * @param {Object} stored - 存储的配置
   * @returns {Object}
   */
  _mergeDefaults(stored) {
    const result = Object.assign({}, this.defaults);
    
    // 合并 backends 对象
    if (stored.backends) {
      result.backends = Object.assign({}, this.defaults.backends, stored.backends);
    }
    
    // 合并其他顶层属性
    Object.keys(stored).forEach(key => {
      if (key !== 'backends') {
        result[key] = stored[key];
      }
    });
    
    return result;
  }

  /**
   * 保存配置
   * @param {Object} config - 要保存的配置对象
   */
  save(config) {
    const current = this.load();
    const merged = this._deepMerge(current, config);
    storageAdapter.setItem(this.storageKey, merged);
    this._cache = merged;
  }

  /**
   * 深度合并对象
   * @param {Object} target - 目标对象
   * @param {Object} source - 源对象
   * @returns {Object}
   */
  _deepMerge(target, source) {
    const result = Object.assign({}, target);
    
    if (source.backends) {
      result.backends = Object.assign({}, target.backends || {}, source.backends);
    }
    
    Object.keys(source).forEach(key => {
      if (key !== 'backends') {
        result[key] = source[key];
      }
    });
    
    return result;
  }

  /**
   * 获取当前配置（不触发加载）
   * @returns {Object}
   */
  getConfig() {
    return this._cache || this.defaults;
  }

  /**
   * 清除缓存（强制重新加载）
   */
  clearCache() {
    this._cache = null;
  }

  /**
   * 获取代理设置
   * @returns {string}
   */
  getProxy() {
    return this.load().proxy || '';
  }

  /**
   * 获取当前激活的后端
   * @returns {string}
   */
  getActiveBackend() {
    return this.load().activeBackend || 'offline_dict';
  }

  /**
   * 设置当前激活的后端
   * @param {string} name - 后端名称
   */
  setActiveBackend(name) {
    this.save({ activeBackend: name });
  }

  /**
   * 是否显示翻译耗时
   * @returns {boolean}
   */
  shouldShowTranslationCost() {
    return this.load().showTranslationCost !== false;
  }
}

// 导出单例
const appConfig = new AppConfig();

module.exports = {
  AppConfig,
  appConfig,
  APP_CONFIG_DEFAULTS
};
