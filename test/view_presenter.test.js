const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  buildResultItems,
  buildLoadingItem,
  buildProgressItem
} = require('../src/utils/view_presenter');

describe('ViewPresenter', () => {
  describe('buildLoadingItem', () => {
    it('should return default loading message', () => {
      const result = buildLoadingItem();
      assert.deepStrictEqual(result, [{ title: '⏳ 正在检索中...', description: '正在检索中...' }]);
    });

    it('should return custom loading message', () => {
      const result = buildLoadingItem('Custom message');
      assert.deepStrictEqual(result, [{ title: '⏳ 正在检索中...', description: 'Custom message' }]);
    });
  });

  describe('buildProgressItem', () => {
    it('should return progress message', () => {
      const result = buildProgressItem('下载中 20%');
      assert.deepStrictEqual(result, [{ title: '词典状态同步', description: '下载中 20%' }]);
    });
  });

  describe('buildResultItems', () => {
    it('should return error message if result has message', () => {
      const result = buildResultItems('test', { message: 'Error msg' });
      assert.strictEqual(result.length, 2);
      assert.strictEqual(result[0].title, '词库未就绪');
    });

    it('should return not found if translation is missing', () => {
      const result = buildResultItems('test', { found: false });
      assert.strictEqual(result.length, 2);
      assert.strictEqual(result[0].title, '未找到释义');
    });

    describe('ZH to EN', () => {
      it('should NOT split multiple English translations into separate items', () => {
        const result = buildResultItems('测试', { 
          found: true, 
          translation: 'test ; trial ; quiz', 
          phonetic: 'cè shì' 
        }, true);
        
        assert.strictEqual(result.length, 2); // 1 translation + 1 advanced
        assert.strictEqual(result[0].title, 'test ; trial ; quiz');
        assert.strictEqual(result[1].isAdvancedOllama, true);
      });

      it('should handle missing phonetic', () => {
        const result = buildResultItems('测试', { 
          found: true, 
          translation: 'test' 
        }, true);
        
        assert.strictEqual(result.length, 2);
        assert.strictEqual(result[0].title, 'test');
        assert.strictEqual(result[1].isAdvancedOllama, true);
      });
      
      it('should handle empty translation string safely', () => {
        const result = buildResultItems('测试', { 
          found: true, 
          translation: '  ;  ' 
        }, true);
        
        assert.strictEqual(result.length, 2);
        assert.strictEqual(result[0].title, ';'); // Trimmed '  ;  ' becomes ';'
        assert.strictEqual(result[1].isAdvancedOllama, true);
      });
    });

    describe('EN to ZH', () => {
      it('should combine phonetic and translation into title', () => {
        const result = buildResultItems('test', { 
          found: true, 
          translation: '测试', 
          phonetic: '[test]' 
        }, false);
        
        assert.strictEqual(result.length, 2);
        assert.strictEqual(result[0].title, '[test] 测试');
        assert.strictEqual(result[1].isAdvancedOllama, true);
      });

      it('should handle missing phonetic', () => {
        const result = buildResultItems('test', { 
          found: true, 
          translation: '测试' 
        }, false);
        
        assert.strictEqual(result.length, 2);
        assert.strictEqual(result[0].title, '测试');
        assert.strictEqual(result[1].isAdvancedOllama, true);
      });
    });

    describe('Cost Time Information', () => {
      const mockResult = { found: true, translation: 'demo' };
      
      it('should append cost time item if costTime is provided and showCostConfig is true', () => {
        const result = buildResultItems('test', mockResult, false, 1500, 'Test Backend');
        assert.strictEqual(result.length, 3); // 1 translation + 1 advanced + 1 cost
        assert.strictEqual(result[2].title, '⚡ 本地翻译耗时: 1.50秒');
      });

      it('should hide cost time item if showCostConfig is false', () => {
        const result = buildResultItems('test', mockResult, false, 1500, 'Test Backend', false);
        assert.strictEqual(result.length, 2); // 1 translation + 1 advanced
      });
    });
  });
});
