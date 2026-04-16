/**
 * Backend 配置抽象基类
 * 定义配置加载/保存的统一接口
 */
const { storageAdapter } = require('../../utils/storage_adapter');

class AbstractBackendConfig {
  /**
   * @param {string} storageKey - 存储键
   * @param {Object} defaults - 默认配置
   * @param {string[]} localKeys - 需要在本地存储（不随账号同步/各机器独立）的键名列表
   */
  constructor(storageKey, defaults, localKeys = []) {
    if (new.target === AbstractBackendConfig) {
      throw new Error('AbstractBackendConfig 不能直接实例化');
    }
    this.storageKey = storageKey;
    this.defaults = defaults;
    this.localKeys = localKeys;
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
    let config = stored ? Object.assign({}, this.defaults, stored) : Object.assign({}, this.defaults);

    // [IMPORTANT] 如果同步下来的配置中包含本地键（可能是由于旧版本同步上来的），
    // 必须从同步配置中剔除，以防破坏本地独立性。
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
   * 保存配置
   * @param {Object} config - 要保存的配置对象
   */
  save(config) {
    const current = this.load();
    const merged = Object.assign({}, current, config);
    
    // 1. 分离同步和本地配置
    const sharedConfig = Object.assign({}, merged);
    const localConfig = {};
    let hasLocal = false;

    if (this.localKeys.length > 0) {
      // 从共享配置中移除本地键，并存入本地部分
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
}

module.exports = {
  AbstractBackendConfig
};
