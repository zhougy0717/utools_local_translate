const { describe, it } = require('node:test');
const assert = require('node:assert');
const detector = require('../src/utils/target_language_detector');
const { PromptManager } = require('../src/backends/ollama/prompt-manager');
const languages = require('../src/commands/languages');

describe('Target Language Sync System', () => {

    describe('TargetLanguageDetector', () => {
        it('should detect English and suggest Chinese target', () => {
            const result = detector.detect('Apple');
            assert.strictEqual(result.source, 'en');
            assert.strictEqual(result.target, 'zh');
        });

        it('should detect Chinese and suggest English target', () => {
            const result = detector.detect('苹果');
            assert.strictEqual(result.source, 'zh');
            assert.strictEqual(result.target, 'en');
        });

        it('should handle mixed text containing Chinese as Chinese source', () => {
            const result = detector.detect('The word 苹果 means apple.');
            assert.strictEqual(result.source, 'zh');
            assert.strictEqual(result.target, 'en');
        });

        it('should handle empty/whitespace text with defaults', () => {
            const result = detector.detect('   ');
            assert.strictEqual(result.source, 'en');
            assert.strictEqual(result.target, 'zh');
        });
    });

    describe('PromptManager Dynamic Replacement', () => {
        const pm = new PromptManager();

        it('should replace [TARGET_LANG] with friendly name', () => {
            const prompt = pm.getPrompt('advanced', {
                text: 'hello',
                targetLangCode: 'ja'
            });
            assert.ok(prompt.includes('翻译成 日语'));
            assert.ok(prompt.includes('目标语言：日语'));
        });

        it('should replace [TEXT] with input text', () => {
            const testText = 'Supercalifragilistic';
            const prompt = pm.getPrompt('advanced', {
                text: testText,
                targetLangCode: 'en'
            });
            assert.ok(prompt.includes(`待翻译文本：${testText}`));
        });

        it('should respect custom prompt and still replace placeholders', () => {
            const customTemplate = 'Translate "[TEXT]" into [TARGET_LANG] please.';
            const prompt = pm.getPrompt('advanced', {
                text: 'hi',
                targetLangCode: 'ko',
                prompt: customTemplate
            });
            assert.strictEqual(prompt, 'Translate "hi" into 韩语 please.');
        });

        it('should support legacy ${target_lang} placeholder', () => {
            const legacyTemplate = 'Translate to ${target_lang}:';
            const prompt = pm.getPrompt('advanced', {
                text: 'apple',
                targetLangCode: 'zh',
                prompt: legacyTemplate
            });
            // 应该替换代码并因为缺少文本占位符而追加文本
            assert.ok(prompt.includes('Translate to 简体中文:'));
            assert.ok(prompt.endsWith('apple'));
        });

        it('should auto-append text if [TEXT] placeholder is missing', () => {
            const noTextTemplate = 'Translate the input to [TARGET_LANG].';
            const prompt = pm.getPrompt('advanced', {
                text: 'banana',
                targetLangCode: 'en',
                prompt: noTextTemplate
            });
            assert.ok(prompt.includes('Translate the input to 英语.'));
            assert.ok(prompt.includes('\n\nbanana'));
        });
        
        it('should handle vision prompt with target language', () => {
            const prompt = pm.getPrompt('vision', {
                targetLangCode: 'zh'
            });
            assert.ok(prompt.includes('翻译为 简体中文'));
            assert.ok(prompt.includes('根据上述逻辑生成的 简体中文 译文'));
        });
    });

    describe('Languages Helper', () => {
        it('getNameByCode should return clean Chinese names', () => {
            assert.strictEqual(languages.getNameByCode('en'), '英语');
            assert.strictEqual(languages.getNameByCode('zh'), '简体中文');
            assert.strictEqual(languages.getNameByCode('ja'), '日语');
            assert.strictEqual(languages.getNameByCode('unknown'), 'unknown');
        });
    });
});
