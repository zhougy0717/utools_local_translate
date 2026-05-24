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
    testUrl: 'https://www.google.com',
    sslVerify: true
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
    this.localKeys = ['resourcePath'];
    this._cache = null;
  }

  /**
   * 获取本地存储的 Key
   * @returns {string}
   */
  _getLocalKey() {
    return `${this.storageKey}_local_${storageAdapter.getNativeId()}`;
  }

  /**
   * 加载配置（带缓存）
   * @returns {Object} 合并后的配置
   */
  load() {
    if (this._cache !== null) {
      return this._cache;
    }

    // 1. 加载常规存储 (同步部分)
    const stored = storageAdapter.getItem(this.storageKey);
    let config;
    if (stored) {
      // 执行向后兼容迁移
      const migrated = this._migrateProxy(stored);
      config = this._mergeDefaults(migrated);
    } else {
      config = JSON.parse(JSON.stringify(this.defaults));
    }

    // [IMPORTANT] 剔除同步配置中可能存在的本地键 (针对历史同步数据的兜底)
    if (this.localKeys.length > 0) {
      this.localKeys.forEach(key => {
        delete config[key];
      });
    }

    // 2. 加载本地存储 (非同步部分)
    if (this.localKeys.length > 0) {
      const localStored = storageAdapter.getItem(this._getLocalKey());
      if (localStored) {
        this.localKeys.forEach(key => {
          if (localStored[key] !== undefined) {
            config[key] = localStored[key];
          }
        });
      }
    }

    this._cache = config;
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
    const current = JSON.parse(JSON.stringify(this.load())); // 确保操作的是纯数据对象
    const merged = this._deepMerge(current, config);
    
    // 1. 分离同步和本地配置
    const sharedConfig = JSON.parse(JSON.stringify(merged));
    const localConfig = {};
    let hasLocal = false;

    if (this.localKeys.length > 0) {
      this.localKeys.forEach(key => {
        if (merged[key] !== undefined) {
          localConfig[key] = merged[key];
          delete sharedConfig[key];
          hasLocal = true;
        }
      });
    }

    // 2. 保存到各自存储
    storageAdapter.setItem(this.storageKey, sharedConfig);
    if (hasLocal) {
      storageAdapter.setItem(this._getLocalKey(), localConfig);
    }

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
    
    // 如果是类实例，转为纯对象（安全保障）
    const cleanSource = (source instanceof AppConfig) ? source.load() : source;

    if (cleanSource.backends) {
      result.backends = Object.assign({}, target.backends || {}, cleanSource.backends);
    }
    
    Object.keys(cleanSource).forEach(key => {
      if (key !== 'backends') {
        result[key] = cleanSource[key];
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
      const encodedUser = encodeURIComponent(String(p.username || ''));
      const encodedPass = password ? encodeURIComponent(String(password)) : '';
      auth = encodedPass ? `${encodedUser}:${encodedPass}@` : `${encodedUser}@`;
    }
    
    const type = p.type === 'socks5' ? 'socks5' : 'http';
    const cleanHost = String(p.host || '').replace(/^https?:\/\//i, '');
    return `${type}://${auth}${cleanHost}:${p.port}`;
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
   * 设置当前激活的后端，并同步更新状态标志位
   * @param {string} name - 后端名称
   */
  setActiveBackend(name) {
    const backends = {
        offline_dict: name === 'offline_dict',
        ollama: name === 'ollama',
        libretranslate: name === 'libretranslate'
    };
    this.save({ 
        activeBackend: name,
        backends: backends
    });
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
