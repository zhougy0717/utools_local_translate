/**
 * 单元测试：从 SQLite（ecdict.db / cccedict.db）查词功能
 * 使用 Node 内置 node:test 框架，调用 backends/dict 进行测试。
 * 使用 resources 目录，已知词用例以 "nite" 为例。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const { createDictBackend } = require('../backends/dict/index.js');

const resourcesDir = path.join(__dirname, '..', 'resources');
const backend = createDictBackend({ dictRepoPath: resourcesDir });

function queryWordPromise(backend, word, sourceLang, targetLang) {
  return new Promise((resolve, reject) => {
    backend.queryWord(word, sourceLang || 'en', targetLang || 'zh', (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
}

describe('ecdict 从 SQLite 查词', function () {
  it('未配置 dictRepoPath 时拦截并提示', async function () {
    const emptyBackend = createDictBackend({});
    const result = await queryWordPromise(emptyBackend, 'nite', 'en', 'zh');
    assert.strictEqual(result.found, false, '未配置时应该返回 found: false');
    assert.ok(result.message.includes('请配置词典绝对路径'), '应该提示配置路径');
  });

  it('已知词 nite 能查到且返回 found 与 translation (如果有db)', async function () {
    const dbPath = path.join(resourcesDir, 'ecdict.db');
    if (!fs.existsSync(dbPath)) return this.skip();

    const result = await queryWordPromise(backend, 'nite', 'en', 'zh');
    assert.strictEqual(result.found, true, 'nite 应能查到');
    assert.ok(typeof result.translation === 'string', '应有 translation');
  });

  it('未知词返回 found: false', async function () {
    const dbPath = path.join(resourcesDir, 'ecdict.db');
    if (!fs.existsSync(dbPath)) return this.skip();

    const result = await queryWordPromise(backend, 'xyznonexistent123', 'en', 'zh');
    assert.ok(result, '应返回结果对象');
    assert.strictEqual(result.found, false, '不存在的词应返回 found: false');
  });

  it('大小写不敏感：Nite 与 nite 均可查到 (如果有db)', async function () {
    const dbPath = path.join(resourcesDir, 'ecdict.db');
    if (!fs.existsSync(dbPath)) return this.skip();

    const r1 = await queryWordPromise(backend, 'Nite', 'en', 'zh');
    const r2 = await queryWordPromise(backend, 'nite', 'en', 'zh');
    assert.strictEqual(r1.found, true, 'Nite 应能查到');
    assert.strictEqual(r2.found, true, 'nite 应能查到');
    assert.strictEqual(r1.translation, r2.translation, '大小写不同应得到相同释义');
  });

  it('词库不存在时返回 found: false 或 message 提示', async function () {
    const notExistPath = path.join(__dirname, '..', 'resources', 'nonexist_dir_123');
    const backendNoDb = createDictBackend({ dictRepoPath: notExistPath });
    const result = await queryWordPromise(backendNoDb, 'nite', 'en', 'zh');
    assert.ok(result, '应返回结果对象');
    assert.strictEqual(result.found, false, '词库不存在时应 found: false');
    if (result.message) {
      assert.ok(result.message.length > 0, '若有 message 应非空');
    }
  });

  it('中→英：已知中文词返回 found: true 且 translation 为英文 (如果有db)', async function () {
    const dbPath = path.join(resourcesDir, 'cccedict.db');
    if (!fs.existsSync(dbPath)) return this.skip();

    const result = await queryWordPromise(backend, '中国', 'zh', 'en');
    assert.strictEqual(result.found, true, '中国 应能查到');
    assert.ok(typeof result.translation === 'string', '应有 translation');
  });

  it('中→英：未知中文词返回 found: false', async function () {
    const dbPath = path.join(resourcesDir, 'cccedict.db');
    if (!fs.existsSync(dbPath)) return this.skip();

    const result = await queryWordPromise(backend, '不存在词条xyz', 'zh', 'en');
    assert.ok(result, '应返回结果对象');
    assert.strictEqual(result.found, false, '不存在的词应返回 found: false');
  });
});
