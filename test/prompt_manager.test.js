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

  await t.test('getDefaultTemplate should return advanced translation prompt', () => {
    const manager = new PromptManager();
    const template = manager.getDefaultTemplate();
    assert.ok(template.includes('[TARGET_LANG]'));
    assert.ok(template.includes('[TEXT]'));
    assert.ok(template.includes('翻译官'));
  });
});
