const { describe, it } = require('node:test');
const assert = require('node:assert');
const CommandManager = require('../commands/index.js');

describe('Slash Command Manager', () => {

    it('handleSearch without specific command should return root commands', (t, done) => {
        CommandManager.handleSearch('/', (list) => {
            assert.strictEqual(list.length, 1);
            assert.strictEqual(list[0].title, '选择模式');
            assert.strictEqual(list[0].isRootCommand, true);
            done();
        });
    });

    it('handleSearch with "/m" should filter root commands', (t, done) => {
        CommandManager.handleSearch('/m', (list) => {
            assert.strictEqual(list.length, 1);
            assert.strictEqual(list[0].trigger, 'mode');
            done();
        });
    });

    it('handleSearch with invalid command should return Not Found', (t, done) => {
        CommandManager.handleSearch('/xxxxx', (list) => {
            assert.strictEqual(list.length, 1);
            assert.strictEqual(list[0].title, '未找到匹配的命令');
            done();
        });
    });

    it('handleSearch with "/mode " should return mode sub-items', (t, done) => {
        CommandManager.handleSearch('/mode ', (list) => {
            assert.strictEqual(list.length, 2);
            assert.strictEqual(list[0].modeId, 'offline_dict');
            assert.strictEqual(list[1].modeId, 'helsinki_model');
            done();
        });
    });

    it('handleSearch with exact "/mode" (no trailing space) should return mode sub-items', (t, done) => {
        CommandManager.handleSearch('/mode', (list) => {
            assert.strictEqual(list.length, 2);
            assert.strictEqual(list[0].modeId, 'offline_dict');
            assert.strictEqual(list[1].modeId, 'helsinki_model');
            done();
        });
    });

    it('handleSelect on root command should return autoComplete', () => {
        const itemData = {
            isCommandContext: true,
            isRootCommand: true,
            trigger: 'mode'
        };
        const result = CommandManager.handleSelect(itemData, {});
        assert.deepStrictEqual(result, { autoComplete: '/mode ' });
    });

    it('handleSelect on mode sub-item should mutate appConfig and return side effects', () => {
        const itemData = {
            isCommandContext: true,
            commandTrigger: 'mode',
            modeId: 'helsinki_model'
        };
        const appConfig = { backends: { offline_dict: true, helsinki_model: false } };

        // mock global utools
        global.utools = {
            dbStorage: {
                setItem(key, val) {
                    assert.strictEqual(key, 'app_config');
                    assert.deepStrictEqual(val, appConfig);
                }
            }
        };

        const result = CommandManager.handleSelect(itemData, appConfig);

        assert.strictEqual(appConfig.backends.helsinki_model, true);
        assert.strictEqual(appConfig.backends.offline_dict, false);

        assert.deepStrictEqual(result, {
            reloadBackend: true,
            restoreSearch: true
        });

        // clean up
        delete global.utools;
    });

});
