/**
 * Storage 层测试
 */
const { MemoryStorage } = require('../../src/utils/storage_adapter');

describe('StorageAdapter', () => {
  let storage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  describe('MemoryStorage', () => {
    test('基础读写：写入后读取应返回写入的值', () => {
      storage.setItem('testKey', 'testValue');
      expect(storage.getItem('testKey')).toBe('testValue');
    });

    test('空值处理：读取不存在的键应返回 null', () => {
      expect(storage.getItem('nonExistent')).toBeNull();
    });

    test('覆盖更新：同一键多次写入应保留最后一次的值', () => {
      storage.setItem('key', 'value1');
      storage.setItem('key', 'value2');
      expect(storage.getItem('key')).toBe('value2');
    });

    test('类型保持：写入对象/数组应保持类型一致', () => {
      const obj = { a: 1, b: 2 };
      storage.setItem('obj', obj);
      expect(storage.getItem('obj')).toEqual(obj);

      const arr = [1, 2, 3];
      storage.setItem('arr', arr);
      expect(storage.getItem('arr')).toEqual(arr);
    });
  });
});
