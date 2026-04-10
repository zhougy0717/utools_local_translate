const { describe, it, test } = require('node:test');
const assert = require('node:assert');
const { MemoryStorage } = require('../src/utils/storage_adapter');

describe('MemoryStorage', () => {
    test('写入并读取：应当能存取正确的值', () => {
        const storage = new MemoryStorage();
        storage.setItem('test_key', 'test_value');
        assert.strictEqual(storage.getItem('test_key'), 'test_value');
    });

    test('覆盖更新：同一键多次写入应保留最后一次的值', () => {
        const storage = new MemoryStorage();
        storage.setItem('k', 'v1');
        storage.setItem('k', 'v2');
        assert.strictEqual(storage.getItem('k'), 'v2');
    });

    test('类型保持：写入对象/数组应保持类型一致', () => {
        const storage = new MemoryStorage();
        const obj = { success: true };
        storage.setItem('obj', obj);
        assert.deepStrictEqual(storage.getItem('obj'), obj);
    });
});
