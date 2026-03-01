/**
 * 单元测试：isLikelyChinese 输入语言检测
 * 覆盖纯英文、纯中文、中英混合、空串、仅数字/符号等。
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { isLikelyChinese } = require('../preload.js');

describe('isLikelyChinese', function () {
  it('纯英文返回 false', function () {
    assert.strictEqual(isLikelyChinese('hello'), false);
    assert.strictEqual(isLikelyChinese('world'), false);
    assert.strictEqual(isLikelyChinese('nite'), false);
  });

  it('纯中文返回 true', function () {
    assert.strictEqual(isLikelyChinese('中国'), true);
    assert.strictEqual(isLikelyChinese('你好'), true);
    assert.strictEqual(isLikelyChinese('世界'), true);
  });

  it('中英混合返回 true', function () {
    assert.strictEqual(isLikelyChinese('hello世界'), true);
    assert.strictEqual(isLikelyChinese('中国 China'), true);
  });

  it('空串或仅空格返回 false', function () {
    assert.strictEqual(isLikelyChinese(''), false);
    assert.strictEqual(isLikelyChinese('   '), false);
    assert.strictEqual(isLikelyChinese('\t\n'), false);
  });

  it('仅数字/符号返回 false', function () {
    assert.strictEqual(isLikelyChinese('123'), false);
    assert.strictEqual(isLikelyChinese('1.5'), false);
    assert.strictEqual(isLikelyChinese('!@#'), false);
  });

  it('含中文则返回 true', function () {
    assert.strictEqual(isLikelyChinese('1个'), true);
    assert.strictEqual(isLikelyChinese('test测试'), true);
  });
});
