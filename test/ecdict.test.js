/**
 * 单元测试：从 SQLite（ecdict.db）查词功能
 * 使用 Node 内置 node:test 框架，调用 backends/ecdict 进行测试。
 * 使用 resources/ecdict.db，已知词用例以 "nite" 为例。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const { createEcdictBackend } = require('../backends/ecdict.js');

const backend = createEcdictBackend();
const resourcesDir = path.join(__dirname, '..', 'resources');

function queryWordPromise(backend, word, sourceLang, targetLang) {
  return new Promise((resolve, reject) => {
    backend.queryWord(word, sourceLang || 'en', targetLang || 'zh', (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
}

describe('ecdict 从 SQLite 查词', function () {
  it('已知词 nite 能查到且返回 found 与 translation', async function () {
    const result = await queryWordPromise(backend, 'nite', 'en', 'zh');
    assert.ok(result, '应返回结果对象');
    assert.strictEqual(result.found, true, 'nite 应能查到');
    assert.ok(typeof result.translation === 'string', '应有 translation');
    assert.ok(result.translation.length > 0, 'translation 非空');
  });

  it('未知词返回 found: false', async function () {
    const result = await queryWordPromise(backend, 'xyznonexistent123', 'en', 'zh');
    assert.ok(result, '应返回结果对象');
    assert.strictEqual(result.found, false, '不存在的词应返回 found: false');
  });

  it('大小写不敏感：Nite 与 nite 均可查到', async function () {
    const r1 = await queryWordPromise(backend, 'Nite', 'en', 'zh');
    const r2 = await queryWordPromise(backend, 'nite', 'en', 'zh');
    assert.strictEqual(r1.found, true, 'Nite 应能查到');
    assert.strictEqual(r2.found, true, 'nite 应能查到');
    assert.strictEqual(r1.translation, r2.translation, '大小写不同应得到相同释义');
  });

  it('词库不存在时返回 found: false 或 message 提示', async function () {
    const notExistPath = path.join(__dirname, '..', 'resources', 'nonexist.db');
    const backendNoDb = createEcdictBackend({ dbPath: notExistPath });
    const result = await queryWordPromise(backendNoDb, 'nite', 'en', 'zh');
    assert.ok(result, '应返回结果对象');
    assert.strictEqual(result.found, false, '词库不存在时应 found: false');
    if (result.message) {
      assert.ok(result.message.length > 0, '若有 message 应非空');
    }
  });

  it('中→英：已知中文词返回 found: true 且 translation 为英文', async function () {
    const result = await queryWordPromise(backend, '中国', 'zh', 'en');
    assert.ok(result, '应返回结果对象');
    assert.strictEqual(result.found, true, '中国 应能查到');
    assert.ok(typeof result.translation === 'string', '应有 translation');
    assert.ok(result.translation.length > 0, 'translation 非空');
    assert.ok(/[a-zA-Z]/.test(result.translation), 'translation 应为英文');
  });

  it('中→英：未知中文词返回 found: false', async function () {
    const result = await queryWordPromise(backend, '不存在词条xyz', 'zh', 'en');
    assert.ok(result, '应返回结果对象');
    assert.strictEqual(result.found, false, '不存在的词应返回 found: false');
  });

  it('中→英：cccedict.db 不存在时返回 found: false 及 message', async function () {
    const notExistPath = path.join(__dirname, '..', 'resources', 'nonexist_cccedict.db');
    const backendNoCccedict = createEcdictBackend({ cccedictDbPath: notExistPath });
    const result = await queryWordPromise(backendNoCccedict, '中国', 'zh', 'en');
    assert.ok(result, '应返回结果对象');
    assert.strictEqual(result.found, false, '词库不存在时应 found: false');
    assert.ok(result.message && result.message.length > 0, '应有 message 提示');
  });

  it('仅 .gz 时首次中→英能解压并查词，解压后 .gz 已删除', async function () {
    const tmpDir = path.join(__dirname, 'tmp_zip_' + Date.now());
    fs.mkdirSync(tmpDir, { recursive: true });
    const gzPath = path.join(tmpDir, 'cccedict.db.gz');
    const dbPath = path.join(tmpDir, 'cccedict.db');
    const srcGz = path.join(resourcesDir, 'cccedict.db.gz');
    if (!fs.existsSync(srcGz)) {
      try { fs.rmdirSync(tmpDir); } catch (_) {}
      this.skip();
      return;
    }
    fs.copyFileSync(srcGz, gzPath);
    const backendGz = createEcdictBackend({ cccedictDbPath: dbPath });
    const result = await queryWordPromise(backendGz, '中国', 'zh', 'en');
    assert.ok(result, '应返回结果对象');
    assert.strictEqual(result.found, true, '仅 .gz 时首次应能解压并查到');
    assert.ok(fs.existsSync(dbPath), '解压后 .db 应存在');
    assert.ok(!fs.existsSync(gzPath), '解压成功后 .gz 应已删除');
    const result2 = await queryWordPromise(backendGz, '中国', 'zh', 'en');
    assert.strictEqual(result2.found, true, '再次查词应仍正常');
    try { fs.unlinkSync(dbPath); } catch (_) {}
    try { fs.rmdirSync(tmpDir); } catch (_) {}
  });
});
