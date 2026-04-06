const test = require('node:test');
const assert = require('node:assert');
const { PromptManager } = require('../src/backends/ollama/prompt-manager');

test('PromptManager tests', async (t) => {
  await t.test('buildPrompt should correctly replace [TARGET_LANG] and [TEXT]', () => {
    const manager = new PromptManager();
    const template = 'Translate "[TEXT]" into [TARGET_LANG].';
    const result = manager.buildPrompt(template, {
      text: 'Hello',
      targetLang: '中文'
    });
    
    assert.strictEqual(result, 'Translate "Hello" into 中文.');
  });

  await t.test('getPrompt should return vision prompt when taskType is vision', () => {
    const manager = new PromptManager();
    const result = manager.getPrompt('vision', { targetLangCode: 'en' });
    assert.ok(result.includes('OCR'));
    assert.ok(result.includes('英文'));
    assert.ok(!result.includes('[TARGET_LANG]'));
  });

  await t.test('getPromptTemplate should return template with [TEXT] for UI use', () => {
    const manager = new PromptManager();
    const result = manager.getPromptTemplate('advanced', 'zh');
    assert.ok(result.includes('[TEXT]'));
    assert.ok(result.includes('中文'));
  });
});
