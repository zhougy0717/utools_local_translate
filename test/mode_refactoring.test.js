const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const ModeCommand = require('../src/commands/mode.js');

describe('Mode Command Refactoring - Characterization Tests', () => {
    
    // Preparation
    const mockAppConfig = {
        backends: {
            offline_dict: true,
            ollama: false,
            libretranslate: false
        }
    };

    before(() => {
        global.utools = {
            dbStorage: {
                setItem: (key, val) => {},
                getItem: (key) => null
            },
            shellOpenExternal: (url) => {}
        };
    });

    after(() => {
        delete global.utools;
    });

    describe('handleSearch', () => {
        it('should return 3 translation modes', (t, done) => {
            ModeCommand.handleSearch('', (list) => {
                assert.strictEqual(list.length, 3);
                assert.strictEqual(list[0].modeId, 'offline_dict');
                assert.strictEqual(list[1].modeId, 'ollama');
                assert.strictEqual(list[2].modeId, 'libretranslate');
                done();
            }, mockAppConfig);
        });

        it('should mark the active mode with a star icon', (t, done) => {
            ModeCommand.handleSearch('', (list) => {
                const activeItem = list.find(i => i.modeId === 'offline_dict');
                assert.ok(activeItem.title.includes('🌟'));
                done();
            }, mockAppConfig);
        });
    });

    describe('handleSelect', () => {
        it('should return navigation sub-menu when clicking a mode without action', () => {
            const itemData = {
                modeId: 'ollama',
                isCommandContext: true,
                commandTrigger: 'mode'
            };
            
            let capturedList = [];
            const callbackSetList = (list) => { capturedList = list; };

            const signal = ModeCommand.handleSelect(itemData, mockAppConfig, callbackSetList);
            
            assert.strictEqual(signal.disableClear, true);
            assert.strictEqual(capturedList.length, 2);
            assert.ok(capturedList.some(i => i.action === 'confirm_ollama'));
            assert.ok(capturedList.some(i => i.action === 'open_ollama_config'));
        });

        it('should perform mutual exclusive activation and persist to DB on confirm_ollama', () => {
            const itemData = {
                modeId: 'ollama',
                action: 'confirm_ollama',
                isCommandContext: true
            };
            
            const appConfig = {
                backends: {
                    offline_dict: true,
                    ollama: false,
                    libretranslate: false
                }
            };

            let dbUpdate = null;
            global.utools.dbStorage.setItem = (key, val) => {
                if (key === 'app_config') dbUpdate = JSON.parse(JSON.stringify(val));
            };

            const signal = ModeCommand.handleSelect(itemData, appConfig, () => {});
            
            assert.strictEqual(appConfig.backends.ollama, true);
            assert.strictEqual(appConfig.backends.offline_dict, false);
            assert.deepStrictEqual(dbUpdate, appConfig);
            assert.strictEqual(signal.reloadBackend, true);
            assert.strictEqual(signal.restoreSearch, true);
        });

        it('should open config panel and persist status for open_ollama_config', () => {
            const itemData = {
                modeId: 'ollama',
                action: 'open_ollama_config',
                isCommandContext: true
            };
            
            const appConfig = { backends: { ollama: false } };
            const signal = ModeCommand.handleSelect(itemData, appConfig, () => {});
            
            assert.strictEqual(appConfig.backends.ollama, true);
            assert.strictEqual(signal.openConfigPanel, true);
            assert.strictEqual(signal.reloadBackend, true);
        });

        it('should open external browser for LibreTranslate docs', () => {
            const itemData = {
                modeId: 'libretranslate',
                action: 'open_libre_docs',
                isCommandContext: true
            };
            
            let openedUrl = '';
            global.utools.shellOpenExternal = (url) => { openedUrl = url; };

            const signal = ModeCommand.handleSelect(itemData, {}, () => {});
            
            assert.ok(openedUrl.includes('libretranslate.com'));
            assert.strictEqual(signal.restoreSearch, true);
        });
    });

    describe('handleSearch - Filtering', () => {
        it('should filter items based on subInput', (t, done) => {
            ModeCommand.handleSearch('Olla', (list) => {
                assert.strictEqual(list.length, 1);
                assert.strictEqual(list[0].modeId, 'ollama');
                done();
            }, mockAppConfig);
        });
    });
});
