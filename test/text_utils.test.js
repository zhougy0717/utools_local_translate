const { describe, it } = require('node:test');
const assert = require('node:assert');
const { getCharWidth, toNamingStyles } = require('../src/utils/text_utils');

describe('TextUtils', () => {
  describe('getCharWidth', () => {
    it('should return 2 for CJK characters', () => {
      assert.strictEqual(getCharWidth('你'), 2);
      assert.strictEqual(getCharWidth('。'), 2);
    });
    it('should return 1 for ASCII characters', () => {
      assert.strictEqual(getCharWidth('a'), 1);
      assert.strictEqual(getCharWidth(' '), 1);
      assert.strictEqual(getCharWidth('1'), 1);
    });
  });

  describe('toNamingStyles', () => {
    it('should convert phrase to various styles', () => {
      const result = toNamingStyles('hello world');
      assert.strictEqual(result.pascal, 'HelloWorld');
      assert.strictEqual(result.camel, 'helloWorld');
      assert.strictEqual(result.snake, 'hello_world');
      assert.strictEqual(result.constant, 'HELLO_WORLD');
      assert.strictEqual(result.kebab, 'hello-world');
    });

    it('should handle special characters', () => {
      const result = toNamingStyles('user-login_status  test');
      assert.strictEqual(result.pascal, 'UserLoginStatusTest');
    });

    it('should handle empty input', () => {
      const result = toNamingStyles('');
      assert.strictEqual(result.pascal, '');
    });
  });
});
