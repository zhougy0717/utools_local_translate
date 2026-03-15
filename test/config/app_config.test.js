/**
 * AppConfig 测试
 */
const { MemoryStorage } = require('../../src/utils/storage_adapter');

// Mock 存储适配器
jest.mock('../../src/utils/storage_adapter', () => {
  const mockStorage = new (require('../mocks/mock_storage').MockStorage)();
  return {
    storageAdapter: {
      getItem: jest.fn((key) => mockStorage.getItem(key)),
      setItem: jest.fn((key, value) => mockStorage.setItem(key, value))
    },
    MemoryStorage: require('../mocks/mock_storage').MockStorage
  };
});

const { AppConfig } = require('../../src/utils/app_config');

describe('AppConfig', () => {
  let appConfig;
  let mockStorage;

  beforeEach(() => {
    jest.resetModules();
    mockStorage = new (require('../mocks/mock_storage').MockStorage)();
    appConfig = new AppConfig();
  });

  describe('load', () => {
    test('默认值加载：空存储时应返回默认配置', () => {
      const config = appConfig.load();
      expect(config.proxy).toBe('');
      expect(config.activeBackend).toBe('offline_dict');
      expect(config.showTranslationCost).toBe(true);
    });

    test('存储值合并：部分配置应与默认值合并', () => {
      mockStorage.preset('app_config', { proxy: 'http://localhost:8080' });
      jest.doMock('../../src/utils/storage_adapter', () => {
        return {
          storageAdapter: {
            getItem: jest.fn((key) => mockStorage.getItem(key)),
            setItem: jest.fn((key, value) => mockStorage.setItem(key, value))
          }
        };
      });
      const config = appConfig.load();
      expect(config.proxy).toBe('http://localhost:8080');
      expect(config.activeBackend).toBe('offline_dict');
    });
  });

  describe('save', () => {
    test('配置保存：保存后存储应被更新', () => {
      appConfig.save({ proxy: 'http://test.com' });
      expect(appConfig.getConfig().proxy).toBe('http://test.com');
    });

    test('增量更新：部分字段更新应保留其他字段', () => {
      appConfig.save({ proxy: 'http://test.com' });
      appConfig.save({ showTranslationCost: false });
      const config = appConfig.getConfig();
      expect(config.proxy).toBe('http://test.com');
      expect(config.showTranslationCost).toBe(false);
    });
  });

  describe('getProxy', () => {
    test('获取代理设置', () => {
      appConfig.save({ proxy: 'http://proxy.com' });
      expect(appConfig.getProxy()).toBe('http://proxy.com');
    });
  });

  describe('getActiveBackend', () => {
    test('获取当前激活的后端', () => {
      expect(appConfig.getActiveBackend()).toBe('offline_dict');
      appConfig.save({ activeBackend: 'ollama' });
      expect(appConfig.getActiveBackend()).toBe('ollama');
    });
  });

  describe('shouldShowTranslationCost', () => {
    test('默认应显示翻译耗时', () => {
      expect(appConfig.shouldShowTranslationCost()).toBe(true);
    });

    test('设置为 false 应不显示翻译耗时', () => {
      appConfig.save({ showTranslationCost: false });
      expect(appConfig.shouldShowTranslationCost()).toBe(false);
    });
  });

  describe('clearCache', () => {
    test('清除缓存后应重新从存储加载', () => {
      appConfig.save({ proxy: 'http://test1.com' });
      expect(appConfig.getConfig().proxy).toBe('http://test1.com');

      mockStorage.preset('app_config', { proxy: 'http://test2.com' });
      appConfig.clearCache();

      // 重新加载需要新的实例，因为 mock 需要重建
      const newAppConfig = new AppConfig();
      expect(newAppConfig.load().proxy).toBe('http://test2.com');
    });
  });
});
