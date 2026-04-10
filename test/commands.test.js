const { describe, it } = require('node:test');
const assert = require('node:assert');
const CommandManager = require('../src/commands/index.js');

describe('Slash Command Manager', () => {

    it('handleSearch without specific command should return root commands', (t, done) => {
        CommandManager.handleSearch('/', (list) => {
            assert.strictEqual(list.length, 2);
            assert.strictEqual(list[0].trigger, 'mode');
            assert.strictEqual(list[1].trigger, 'libre');
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

    it('handleSearch with "/l" should filter root commands', (t, done) => {
        CommandManager.handleSearch('/l', (list) => {
            assert.strictEqual(list.length, 1);
            assert.strictEqual(list[0].trigger, 'libre');
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
            assert.strictEqual(list.length, 3);
            assert.strictEqual(list[0].modeId, 'offline_dict');
            assert.strictEqual(list[1].modeId, 'ollama');
            assert.strictEqual(list[2].modeId, 'libretranslate');
            done();
        }, { backends: {} });
    });

    it('handleSearch with exact "/mode" (no trailing space) should return mode sub-items', (t, done) => {
        CommandManager.handleSearch('/mode', (list) => {
            assert.strictEqual(list.length, 3);
            assert.strictEqual(list[0].modeId, 'offline_dict');
            assert.strictEqual(list[1].modeId, 'ollama');
            assert.strictEqual(list[2].modeId, 'libretranslate');
            done();
        }, { backends: {} });
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
            modeId: 'offline_dict',
            action: 'confirm_dict'
        };
        const appConfig = { backends: { offline_dict: false, ollama: false } };

        // mock global utools
        global.utools = {
            dbStorage: {
                setItem(key, val) {
                    assert.strictEqual(key, 'app_config');
                },
                getItem(key) {
                    return null;
                }
            }
        };

        const result = CommandManager.handleSelect(itemData, appConfig, () => {});

        assert.strictEqual(appConfig.backends.offline_dict, true);

        // clean up
        delete global.utools;
    });

});
