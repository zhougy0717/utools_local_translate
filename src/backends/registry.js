/**
 * Backend 注册表
 * 负责管理 Backend 实例的注册和获取
 * 不管理配置，配置由各 Backend 内部自行管理
 */
const { createDictBackend } = require('../dict/index.js');
const { createOllamaBackend } = require('../ollama/index.js');
const { createLibreTranslateBackend } = require('../libretranslate/index.js');

class BackendRegistry {
  constructor() {
    this._backends = {
      offline_dict: createDictBackend,
      ollama: createOllamaBackend,
      libretranslate: createLibreTranslateBackend
    };
    this._instances = {};
    this._activeBackendName = null;
  }

  /**
   * 注册 Backend
   * @param {string} name - Backend 名称
   * @param {Function} factory - Backend 创建工厂函数
   */
  register(name, factory) {
    this._backends[name] = factory;
  }

  /**
   * 获取 Backend 实例
   * @param {string} name - Backend 名称
   * @param {Object} config - 配置对象
   * @returns {Object} Backend 实例
   */
  get(name, config) {
    if (!this._instances[name]) {
      const factory = this._backends[name];
      if (!factory) {
        throw new Error(`Backend "${name}" not found`);
      }
      this._instances[name] = factory(config);
    }
    return this._instances[name];
  }

  /**
   * 设置当前激活的 Backend
   * @param {string} name - Backend 名称
   */
  setActive(name) {
    this._activeBackendName = name;
  }

  /**
   * 获取当前激活的 Backend 名称
   * @returns {string}
   */
  getActiveName() {
    return this._activeBackendName;
  }

  /**
   * 获取当前激活的 Backend 实例
   * @returns {Object}
   */
  getActive(config) {
    if (!this._activeBackendName) {
      return this.get('offline_dict', config);
    }
    return this.get(this._activeBackendName, config);
  }

  /**
   * 获取所有可用的 Backend 列表
   * @returns {Array<{name: string, label: string}>}
   */
  list() {
    return [
      { name: 'offline_dict', label: '本地词典' },
      { name: 'ollama', label: 'Ollama' },
      { name: 'libretranslate', label: 'LibreTranslate' }
    ];
  }

  /**
   * 清除指定 Backend 实例缓存
   * @param {string} name - Backend 名称
   */
  clear(name) {
    if (name && this._instances[name]) {
      const instance = this._instances[name];
      if (typeof instance.stopWorker === 'function') {
        instance.stopWorker();
      }
      delete this._instances[name];
    }
  }

  /**
   * 清除所有 Backend 实例缓存
   */
  clearAll() {
    Object.keys(this._instances).forEach(name => this.clear(name));
    this._activeBackendName = null;
  }

  /**
   * 重置注册表（清除所有实例）
   */
  reset() {
    this.clearAll();
    this._backends = {
      offline_dict: createDictBackend,
      ollama: createOllamaBackend,
      libretranslate: createLibreTranslateBackend
    };
  }
}

// 导出单例
const backendRegistry = new BackendRegistry();

module.exports = {
  BackendRegistry,
  backendRegistry
};
