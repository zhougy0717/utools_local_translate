/**
 * Backend 配置抽象基类
 * 定义配置加载/保存的统一接口
 */
const { storageAdapter } = require('../../src/utils/storage_adapter');

class AbstractBackendConfig {
  /**
   * @param {string} storageKey - 存储键
   * @param {Object} defaults - 默认配置
   */
  constructor(storageKey, defaults) {
    if (new.target === AbstractBackendConfig) {
      throw new Error('AbstractBackendConfig 不能直接实例化');
    }
    this.storageKey = storageKey;
    this.defaults = defaults;
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
      this._cache = Object.assign({}, this.defaults, stored);
    } else {
      this._cache = Object.assign({}, this.defaults);
    }
    return this._cache;
  }

  /**
   * 保存配置
   * @param {Object} config - 要保存的配置对象
   */
  save(config) {
    const current = this.load();
    const merged = Object.assign({}, current, config);
    storageAdapter.setItem(this.storageKey, merged);
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
