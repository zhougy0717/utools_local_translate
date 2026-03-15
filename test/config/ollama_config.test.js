/**
 * OllamaConfig 测试
 */
const { MemoryStorage } = require('../../src/utils/storage_adapter');

// Mock 存储适配器
const mockStorage = {
  _data: {},
  getItem(key) {
    return this._data[key] || null;
  },
  setItem(key, value) {
    this._data[key] = value;
  },
  clear() {
    this._data = {};
  },
  preset(key, value) {
    this._data[key] = value;
  }
};

jest.mock('../../src/utils/storage_adapter', () => ({
  storageAdapter: {
    getItem: jest.fn((key) => mockStorage.getItem(key)),
    setItem: jest.fn((key, value) => mockStorage.setItem(key, value))
  },
  MemoryStorage: class MockStorage {
    constructor() { this._data = {}; }
    getItem(key) { return this._data[key] || null; }
    setItem(key, value) { this._data[key] = value; }
  }
}));

const { OllamaConfig, OLLAMA_DEFAULTS } = require('../../src/backends/ollama/config');

describe('OllamaConfig', () => {
  let config;

  beforeEach(() => {
    jest.resetModules();
    mockStorage.clear();
    config = new OllamaConfig();
  });

  describe('load', () => {
    test('默认值加载：空存储时应返回默认配置', () => {
      const cfg = config.load();
      expect(cfg.apiBase).toBe(OLLAMA_DEFAULTS.apiBase);
      expect(cfg.apiKey).toBe(OLLAMA_DEFAULTS.apiKey);
      expect(cfg.model).toBe(OLLAMA_DEFAULTS.model);
      expect(cfg.temperature).toBe(OLLAMA_DEFAULTS.temperature);
    });

    test('存储值合并：部分配置应与默认值合并', () => {
      mockStorage.preset('backend_ollama', { model: 'llama2', apiBase: 'http://custom:11434' });
      const cfg = config.load();
      expect(cfg.model).toBe('llama2');
      expect(cfg.apiBase).toBe('http://custom:11434');
      expect(cfg.apiKey).toBe(OLLAMA_DEFAULTS.apiKey);
    });
  });

  describe('save', () => {
    test('配置保存：保存后存储应被更新', () => {
      config.save({ model: 'llama2', temperature: 0.5 });
      const cfg = config.load();
      expect(cfg.model).toBe('llama2');
      expect(cfg.temperature).toBe(0.5);
    });

    test('增量更新：部分字段更新应保留其他字段', () => {
      config.save({ model: 'llama2' });
      config.save({ temperature: 0.8 });
      const cfg = config.load();
      expect(cfg.model).toBe('llama2');
      expect(cfg.temperature).toBe(0.8);
    });
  });

  describe('缓存机制', () => {
    test('连续两次 load() 第二次不访问存储', () => {
      const cfg1 = config.load();
      const cfg2 = config.load();
      expect(cfg1).toEqual(cfg2);
    });

    test('clearCache 后应重新从存储加载', () => {
      config.save({ model: 'llama2' });
      expect(config.getConfig().model).toBe('llama2');

      mockStorage.preset('backend_ollama', { model: 'codellama' });
      config.clearCache();

      expect(config.load().model).toBe('codellama');
    });
  });
});
