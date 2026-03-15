/**
 * Mock Storage - 用于测试的内存存储实现
 */
class MockStorage {
  constructor() {
    this._data = {};
  }

  getItem(key) {
    return this._data[key] || null;
  }

  setItem(key, value) {
    this._data[key] = value;
  }

  clear() {
    this._data = {};
  }

  // 辅助方法：预设数据
  preset(key, value) {
    this._data[key] = value;
  }
}

module.exports = {
  MockStorage
};
