/**
 * 存储适配器 - 统一抽象存储接口
 * 屏蔽底层存储差异，生产环境使用 UtoolsStorage，测试环境可注入 Mock 实现
 */

/**
 * @interface StorageAdapter
 * @description 存储抽象接口
 */

/**
 * 获取存储值
 * @param {string} key - 存储键
 * @returns {any} 存储的值
 */

/**
 * 设置存储值
 * @param {string} key - 存储键
 * @param {any} value - 存储的值
 */

/**
 * Utools 存储实现
 */
class UtoolsStorage {
  constructor() {
    this._storage = null;
  }

  getStorage() {
    if (!this._storage) {
      if (typeof utools !== 'undefined' && utools.dbStorage) {
        this._storage = utools.dbStorage;
      } else {
        // 降级到内存存储
        this._storage = new MemoryStorage();
      }
    }
    return this._storage;
  }

  getItem(key) {
    return this.getStorage().getItem(key);
  }

  setItem(key, value) {
    return this.getStorage().setItem(key, value);
  }
}

/**
 * 内存存储实现（用于测试或降级）
 */
class MemoryStorage {
  constructor() {
    this._data = {};
  }

  getItem(key) {
    return this._data[key] || null;
  }

  setItem(key, value) {
    this._data[key] = value;
  }
}

// 导出单例
const storageAdapter = new UtoolsStorage();

module.exports = {
  UtoolsStorage,
  MemoryStorage,
  storageAdapter
};
