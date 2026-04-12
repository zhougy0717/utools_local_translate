/**
 * 应用级配置类
 * 存储键: app_config
 * 管理代理、后端选择、显示选项等应用级配置
 */
const { storageAdapter } = require('./storage_adapter');

const APP_CONFIG_DEFAULTS = {
  proxy: {
    enabled: false,
    authEnabled: false,
    type: 'http',
    host: '',
    port: '',
    username: '',
    testUrl: 'https://www.google.com'
  },
  activeBackend: 'offline_dict',
  showTranslationCost: true,
  backends: {
    offline_dict: true,
    ollama: false,
    libretranslate: false
  },
  translationLanguage: {
    target: 'auto'
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
      // 执行向后兼容迁移
      const migrated = this._migrateProxy(stored);
      this._cache = this._mergeDefaults(migrated);
    } else {
      this._cache = JSON.parse(JSON.stringify(this.defaults));
    }
    return this._cache;
  }

  /**
   * 向后兼容：将字符串形式的 proxy 迁移为对象
   * @param {Object} stored 
   * @returns {Object}
   */
  _migrateProxy(stored) {
    if (typeof stored.proxy === 'string' && stored.proxy.trim() !== '') {
      console.log('[AppConfig] Migrating legacy proxy string to object:', stored.proxy);
      try {
        const proxyStr = stored.proxy.trim();
        let host = proxyStr;
        let port = '';
        
        // 简单处理 http:// 或 https:// 前缀
        let cleanProxy = proxyStr.replace(/^https?:\/\//, '');
        if (cleanProxy.includes(':')) {
          const parts = cleanProxy.split(':');
          host = parts[0];
          port = parts[1];
        }

        stored.proxy = {
          enabled: true,
          authEnabled: false,
          type: 'http',
          host: host,
          port: port,
          username: '',
          testUrl: 'https://www.google.com'
        };
      } catch (e) {
        console.error('[AppConfig] Proxy migration failed:', e);
        stored.proxy = JSON.parse(JSON.stringify(this.defaults.proxy));
      }
    } else if (!stored.proxy || typeof stored.proxy !== 'object') {
      stored.proxy = JSON.parse(JSON.stringify(this.defaults.proxy));
    }

    // 结构化升级：确保存在 authEnabled，且如果已有用户名则默认开启
    if (stored.proxy && typeof stored.proxy === 'object') {
      if (stored.proxy.authEnabled === undefined) {
        stored.proxy.authEnabled = !!(stored.proxy.username && stored.proxy.username.trim() !== '');
      }
    }

    return stored;
  }

  /**
   * 深度合并默认配置
   * @param {Object} stored - 存储的配置
   * @returns {Object}
   */
  _mergeDefaults(stored) {
    const result = Object.assign({}, this.defaults);
    
    // 合并 backends 
    if (stored.backends) {
      result.backends = Object.assign({}, this.defaults.backends, stored.backends);
    }

    // 合并 proxy (深度合并一级)
    if (stored.proxy) {
      result.proxy = Object.assign({}, this.defaults.proxy, stored.proxy);
    }
    
    // 合并其他顶层属性
    Object.keys(stored).forEach(key => {
      if (key !== 'backends' && key !== 'proxy') {
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
   * 获取代理设置 (格式化后的字符串，用于环境变量)
   * @param {boolean} forceEnabled - 是否无视全局开关强制启用 (用于模块化分流控制)
   * @returns {string}
   */
  getProxy(forceEnabled = false) {
    const p = this.load().proxy || {};
    const effectiveEnabled = forceEnabled || p.enabled;
    if (!effectiveEnabled || !p.host || !p.port) return '';
    
    let auth = '';
    if (p.authEnabled && p.username) {
      const password = this.getProxyPassword();
      auth = password ? `${p.username}:${password}@` : `${p.username}@`;
    }
    
    const type = p.type === 'socks5' ? 'socks5' : 'http';
    return `${type}://${auth}${p.host}:${p.port}`;
  }

  /**
   * 从 dbCryptoStorage 获取代理密码
   * @returns {string} 
   */
  getProxyPassword() {
    if (typeof utools === 'undefined' || !utools.dbCryptoStorage) return '';
    return utools.dbCryptoStorage.getItem('proxy_password') || '';
  }

  /**
   * 保存代理设置和加密密码
   * @param {Object} proxyConfig 
   * @param {string} password 
   */
  saveProxyConfig(proxyConfig, password) {
    this.save({ proxy: proxyConfig });
    if (typeof utools !== 'undefined' && utools.dbCryptoStorage) {
      if (password !== undefined) {
          utools.dbCryptoStorage.setItem('proxy_password', password);
      }
    }
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

  /**
   * 获取目标语言设置
   * @returns {string}
   */
  getTranslationTarget() {
    return this.load().translationLanguage?.target || 'auto';
  }

  /**
   * 设置目标语言
   * @param {string} code - 语言代码
   */
  setTranslationTarget(code) {
    const translationLanguage = Object.assign({}, this.load().translationLanguage || { target: 'auto' }, { target: code });
    this.save({ translationLanguage });
  }
}

// 导出单例
const appConfig = new AppConfig();

module.exports = {
  AppConfig,
  appConfig,
  APP_CONFIG_DEFAULTS
};
