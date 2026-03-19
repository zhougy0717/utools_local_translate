const { describe, it } = require('node:test');
const assert = require('node:assert');
const { splitTextToLines, getCharWidth } = require('../src/utils/text_utils');

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

  describe('splitTextToLines', () => {
    it('should split long English sentences without breaking words', () => {
      // "Hello world this is a test" -> 26 chars. Wrap at 10.
      // Expected: "Hello ", "world this ", "is a test" (greedy)
      // Actually: 
      // "Hello " (6) + "world" (5) = 11 > 10. -> Push "Hello ", next is "world " (6)
      // "world " (6) + "this " (5) = 11 > 10. -> Push "world ", next is "this " (5)
      // "this " (5) + "is " (3) = 8 <= 10.
      // "this is " (8) + "a " (2) = 10 <= 10.
      // "this is a " (10) + "test" (4) = 14 > 10. -> Push "this is a ", next "test"
      const text = "Hello world this is a test";
      const result = splitTextToLines(text, 10);
      
      assert.strictEqual(result[0], "Hello ");
      assert.strictEqual(result[1], "world this");
      assert.strictEqual(result[2], " is a test");
    });

    it('should split CJK characters by width', () => {
      const text = "你好世界"; // width 8
      const result = splitTextToLines(text, 4);
      assert.strictEqual(result.length, 2);
      assert.strictEqual(result[0], "你好");
      assert.strictEqual(result[1], "世界");
    });

    it('should handle CJK and English mixed', () => {
      const text = "你好 world"; // width 10 (4 + 1 + 5)
      const result = splitTextToLines(text, 6);
      // "你好 " = 4 + 1 = 5. Next "world" = 5. 5 + 5 = 10 > 6.
      // result: ["你好 ", "world"]
      assert.strictEqual(result[0], "你好 ");
      assert.strictEqual(result[1], "world");
    });

    it('should force break super long words', () => {
      const text = "supercalifragilisticexpialidocious"; // 34 chars
      const result = splitTextToLines(text, 10);
      assert.ok(result.length > 1);
      assert.strictEqual(result[0], "supercalif");
    });
    
    it('should preserve existing newlines', () => {
      const text = "line1\nline2";
      const result = splitTextToLines(text, 80);
      assert.strictEqual(result[0], "line1");
      assert.strictEqual(result[1], "line2");
    });
  });
});
