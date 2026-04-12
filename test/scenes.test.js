const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const CommandManager = require('../src/commands/index.js');

// Mock AppConfig
const mockConfig = {
    getTranslationTarget: () => 'en',
    shouldShowTranslationCost: () => true,
    getTranslationTargetSync: () => 'en'
};

describe('Command Filter Scenes (TDD)', () => {

    beforeEach(() => {
        CommandManager.clearContext();
    });

    // 场景 3.2.1: 显式进入指令
    it('Scene 3.2.1: Should lock context and show sub-items on prefix match "/target"', (t, done) => {
        CommandManager.handleSearch('/target', (list) => {
            try {
                assert.strictEqual(CommandManager.hasContext(), true);
                assert.ok(list.some(item => item.langCode === 'zh'));
                done();
            } catch (e) { done(e); }
        }, mockConfig);
    });

    // 场景 3.2.2: 隐式过滤 (带 Context)
    it('Scene 3.2.2: Should filter sub-items even without slash when context is locked', (t, done) => {
        // 先手动锁定 Context 为 target
        CommandManager.handleSearch('/target', () => {}, mockConfig);
        
        // 模拟输入 "chi"
        CommandManager.handleSearch('chi', (list) => {
            try {
                assert.strictEqual(list.length, 1, 'Expected 1 item (Chinese) but got ' + list.length);
                assert.strictEqual(list[0].title.includes('中文'), true);
                done();
            } catch (e) { done(e); }
        }, mockConfig);
    });

    // 场景 3.2.1-Ext: 点击进入后主框内容为 "/" 的情况
    it('Scene 3.2.1-Ext: Should stay in target context and show sub-items when input is just "/"', (t, done) => {
        CommandManager.handleSearch('/target', () => {}, mockConfig);
        
        CommandManager.handleSearch('/', (list) => {
            try {
                // 不应再显示根指令，而应显示语言列表首项（返回项）
                assert.strictEqual(list[0].isReturnToMain, true);
                done();
            } catch (e) { done(e); }
        }, mockConfig);
    });

    // 场景 3.2.2-Ext: 锁定模式下带斜杠过滤 (例如 "/chi")
    it('Scene 3.2.2-Ext: Should filter using content after slash even without space (e.g. "/chi")', (t, done) => {
        CommandManager.handleSearch('/target', () => {}, mockConfig);
        
        CommandManager.handleSearch('/chi', (list) => {
            try {
                assert.ok(list.some(item => item.title.includes('中文')));
                done();
            } catch (e) { done(e); }
        }, mockConfig);
    });

    // 场景 3.2.3: 粘性模式 (内容为空)
    it('Scene 3.2.3: Should show Return item and full list when input is empty but has context', (t, done) => {
        CommandManager.handleSearch('/target', () => {}, mockConfig);
        
        CommandManager.handleSearch('', (list) => {
            try {
                assert.strictEqual(CommandManager.hasContext(), true);
                assert.strictEqual(list[0].isReturnToMain, true);
                assert.ok(list.length > 1);
                done();
            } catch (e) { done(e); }
        }, mockConfig);
    });

    // 场景 3.2.4: 指令优先级抢占
    it('Scene 3.2.4: Should switch context when a new valid slash command is typed', (t, done) => {
        CommandManager.handleSearch('/target', () => {}, mockConfig);
        assert.strictEqual(CommandManager.activeCommand.trigger, 'target');

        CommandManager.handleSearch('/mode', (list) => {
            try {
                assert.strictEqual(CommandManager.activeCommand.trigger, 'mode');
                assert.ok(list.some(item => item.modeId === 'ollama'));
                done();
            } catch (e) { done(e); }
        }, mockConfig);
    });

    // 场景 3.2.5: 彻底退出 (点击返回项)
    it('Scene 3.2.5: Should clear context when isReturnToMain item is selected', () => {
        CommandManager.handleSearch('/target', () => {}, mockConfig);
        
        const returnItem = { isCommandContext: true, isReturnToMain: true };
        CommandManager.handleSelect(returnItem, mockConfig);
        
        assert.strictEqual(CommandManager.hasContext(), false);
    });
});
