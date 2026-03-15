const { describe, it } = require('node:test');
const assert = require('node:assert');
const CommandManager = require('../src/commands/index.js');

describe('Slash Command Manager', () => {

    it('handleSearch without specific command should return root commands', (t, done) => {
        CommandManager.handleSearch('/', (list) => {
            assert.strictEqual(list.length, 4);
            assert.strictEqual(list[0].trigger, 'mode');
            assert.strictEqual(list[1].trigger, 'path');
            assert.strictEqual(list[2].trigger, 'ollama');
            assert.strictEqual(list[3].trigger, 'proxy');
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

    it('handleSearch with "/p" should filter root commands', (t, done) => {
        CommandManager.handleSearch('/p', (list) => {
            assert.strictEqual(list.length, 2);
            assert.strictEqual(list[0].trigger, 'path');
            assert.strictEqual(list[1].trigger, 'proxy');
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
            assert.strictEqual(list[1].modeId, 'ollama');
            done();
        });
    });

    it('handleSearch with exact "/mode" (no trailing space) should return mode sub-items', (t, done) => {
        CommandManager.handleSearch('/mode', (list) => {
            assert.strictEqual(list.length, 2);
            assert.strictEqual(list[0].modeId, 'offline_dict');
            assert.strictEqual(list[1].modeId, 'ollama');
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
            modeId: 'offline_dict'
        };
        const appConfig = { backends: { offline_dict: false, ollama: false } };

        // mock global utools
        global.utools = {
            dbStorage: {
                setItem(key, val) {
                    assert.strictEqual(key, 'app_config');
                }
            }
        };

        const result = CommandManager.handleSelect(itemData, appConfig);

        assert.strictEqual(appConfig.backends.offline_dict, true);
        assert.strictEqual(appConfig.backends.ollama, false);

        assert.deepStrictEqual(result, {
            reloadBackend: true,
            restoreSearch: true
        });

        // clean up
        delete global.utools;
    });



    it('handleSelect on path default should erase resourcePath', () => {
        const itemData = { isCommandContext: true, commandTrigger: 'path', pathAction: 'default' };
        const appConfig = { resourcePath: 'C:\\old_path' };

        global.utools = {
            dbStorage: {
                setItem(key, val) {
                    assert.strictEqual(val.resourcePath, '');
                }
            }
        };

        const result = CommandManager.handleSelect(itemData, appConfig);
        assert.deepStrictEqual(result, { reloadBackend: true, restoreSearch: true });
        delete global.utools;
    });

    it('handleSelect on path custom should open dialog and save result', () => {
        const itemData = { isCommandContext: true, commandTrigger: 'path', pathAction: 'custom' };
        const appConfig = { resourcePath: '' };

        global.utools = {
            showOpenDialog(options) {
                assert.deepStrictEqual(options.properties, ["openDirectory"]);
                return ['D:\\new_dict_storage'];
            },
            dbStorage: {
                setItem(key, val) {
                    assert.strictEqual(val.resourcePath, 'D:\\new_dict_storage');
                }
            }
        };

        const result = CommandManager.handleSelect(itemData, appConfig);
        assert.deepStrictEqual(result, { reloadBackend: true, restoreSearch: true });
        delete global.utools;
    });

    it('handleSelect on path custom should return empty if dialog cancelled', () => {
        const itemData = { isCommandContext: true, commandTrigger: 'path', pathAction: 'custom' };
        const appConfig = { resourcePath: 'old' };

        global.utools = {
            showOpenDialog() {
                return undefined; // Simulated cancel
            }
        };

        const result = CommandManager.handleSelect(itemData, appConfig);
        assert.deepStrictEqual(result, {});
        assert.strictEqual(appConfig.resourcePath, 'old');
        delete global.utools;
    });

});
