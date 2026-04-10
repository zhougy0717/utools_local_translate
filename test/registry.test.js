const { describe, it, test, beforeEach, afterEach } = require('node:test');
/**
 * BackendRegistry 测试
 */
const { BackendRegistry } = require('../src/backends/registry');

describe('BackendRegistry', () => {
  let registry;

  beforeEach(() => {
    registry = new BackendRegistry();
  });

  describe('register', () => {
    test('注册新的 Backend', () => {
      const factory = () => ({ name: 'test' });
      registry.register('test', factory);
      const backends = registry.list();
      expect(backends.some(b => b.name === 'test')).toBe(false); // list 只返回预定义的
    });
  });

  describe('get', () => {
    test('获取已注册的 Backend 实例', () => {
      const instance = registry.get('offline_dict', { dictRepoPath: '/test' });
      expect(instance).toBeDefined();
      expect(typeof instance.queryWord).toBe('function');
    });

    test('同一 Backend 多次 get 应返回同一实例', () => {
      const instance1 = registry.get('offline_dict', { dictRepoPath: '/test1' });
      const instance2 = registry.get('offline_dict', { dictRepoPath: '/test2' });
      expect(instance1).toBe(instance2);
    });
  });

  describe('setActive / getActive', () => {
    test('设置和获取当前激活的 Backend', () => {
      registry.setActive('ollama');
      expect(registry.getActiveName()).toBe('ollama');
    });

    test('未设置激活时 getActive 返回默认 Backend', () => {
      const instance = registry.getActive({ dictRepoPath: '/test' });
      expect(instance).toBeDefined();
    });
  });

  describe('list', () => {
    test('返回可用的 Backend 列表', () => {
      const backends = registry.list();
      expect(backends).toHaveLength(3);
      expect(backends.map(b => b.name)).toContain('offline_dict');
      expect(backends.map(b => b.name)).toContain('ollama');
      expect(backends.map(b => b.name)).toContain('libretranslate');
    });
  });

  describe('clear', () => {
    test('清除指定 Backend 实例缓存', () => {
      const instance1 = registry.get('offline_dict', { dictRepoPath: '/test' });
      registry.clear('offline_dict');
      const instance2 = registry.get('offline_dict', { dictRepoPath: '/test' });
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('clearAll', () => {
    test('清除所有 Backend 实例', () => {
      registry.get('offline_dict', { dictRepoPath: '/test' });
      registry.get('ollama', {});
      registry.clearAll();
      expect(registry.getActiveName()).toBeNull();
    });
  });
});
