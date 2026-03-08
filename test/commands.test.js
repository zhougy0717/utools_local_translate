const { describe, it } = require('node:test');
const assert = require('node:assert');
const CommandManager = require('../commands/index.js');

describe('Slash Command Manager', () => {

    it('handleSearch without specific command should return root commands', (t, done) => {
        CommandManager.handleSearch('/', (list) => {
            assert.strictEqual(list.length, 3);
            assert.strictEqual(list[0].title, '选择模式');
            assert.strictEqual(list[1].title, '选择翻译模型');
            assert.strictEqual(list[2].title, '存储路径');
            assert.strictEqual(list[0].isRootCommand, true);
            done();
        });
    });

    it('handleSearch with "/m" should filter root commands', (t, done) => {
        CommandManager.handleSearch('/m', (list) => {
            assert.strictEqual(list.length, 2);
            assert.strictEqual(list[0].trigger, 'mode');
            assert.strictEqual(list[1].trigger, 'model');
            done();
        });
    });

    it('handleSearch with "/p" should filter root commands', (t, done) => {
        CommandManager.handleSearch('/p', (list) => {
            assert.strictEqual(list.length, 1);
            assert.strictEqual(list[0].trigger, 'path');
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

    it('handleSearch with exact "/model" should return model sub-items', (t, done) => {
        CommandManager.handleSearch('/model', (list) => {
            assert.strictEqual(list.length, 2);
            assert.strictEqual(list[0].modelId, 'helsinki-nlp/opus-mt');
            assert.strictEqual(list[1].modelId, 'placeholder');
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

    it('handleSelect on helsinki model sub-item should persist selected_model and return reload side effects', () => {
        const itemData = {
            isCommandContext: true,
            commandTrigger: 'model',
            modelId: 'helsinki-nlp/opus-mt'
        };
        const appConfig = { backends: {} };

        // mock global utools
        global.utools = {
            dbStorage: {
                setItem(key, val) {
                    assert.strictEqual(key, 'app_config');
                    assert.strictEqual(val.backends.selected_model, 'helsinki-nlp/opus-mt');
                }
            }
        };

        const result = CommandManager.handleSelect(itemData, appConfig);

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
