const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('assert');
const nock = require('nock');
const libreCommand = require('../src/commands/libre.js');

describe('LibreTranslate Command', () => {
    let mockAppConfig;

    beforeEach(() => {
        mockAppConfig = {
            backends: {
                libretranslate: false,
                ollama: false,
                offline_dict: true
            },
            libretranslate: {
                apiBase: '',
                apiKey: ''
            }
        };

        if (typeof global.fetch !== 'function') {
            global.fetch = require('node-fetch');
        }
        
        global.utools = {
            dbStorage: {
                setItem: (key, val) => {}
            },
            showNotification: (msg) => {},
            shellOpenExternal: (url) => {}
        };
    });

    afterEach(() => {
        nock.cleanAll();
    });

    it('should provide open_docs option always', () => {
        let itemsResult = [];
        libreCommand.handleSearch('', (items) => {
            itemsResult = items;
        }, mockAppConfig);
        const docItem = itemsResult.find(i => i.action === 'open_docs');
        assert.ok(docItem);
        assert.strictEqual(docItem.title, '访问 LibreTranslate 官网文档');
    });

    it('should provide save_and_test option when url is provided', () => {
        let itemsResult = [];
        libreCommand.handleSearch('http://test.com mykey', (items) => {
            itemsResult = items;
        }, mockAppConfig);
        const saveItem = itemsResult.find(i => i.action === 'save_and_test');
        assert.ok(saveItem);
        assert.strictEqual(saveItem.apiBase, 'http://test.com');
        assert.strictEqual(saveItem.apiKey, 'mykey');
    });

    it('should save config and reload on successful test', async () => {
        nock('http://test.com')
            .get('/languages')
            .reply(200, []);

        const itemData = {
            action: 'save_and_test',
            apiBase: 'http://test.com',
            apiKey: 'mykey'
        };

        const signal = await libreCommand.handleSelect(itemData, mockAppConfig, (items) => {});
        
        assert.strictEqual(mockAppConfig.libretranslate.apiBase, 'http://test.com');
        assert.strictEqual(mockAppConfig.libretranslate.apiKey, 'mykey');
        assert.strictEqual(mockAppConfig.backends.libretranslate, true);
        assert.strictEqual(mockAppConfig.backends.ollama, false);
        assert.strictEqual(mockAppConfig.backends.offline_dict, false);
        assert.strictEqual(signal.reloadBackend, true);
        assert.strictEqual(signal.restoreSearch, true);
    });

    it('should handle failed test gracefully', async () => {
        nock('http://bad-test.com')
            .get('/languages')
            .reply(500);

        const itemData = {
            action: 'save_and_test',
            apiBase: 'http://bad-test.com',
            apiKey: ''
        };

        let allCalledItems = [];
        const signal = await libreCommand.handleSelect(itemData, mockAppConfig, (items) => {
            allCalledItems.push(...items);
        });
        
        const errorItem = allCalledItems.find(i => i.title === '连接失败');
        assert.ok(errorItem, 'Should find error item');
        assert.ok(errorItem.description.includes('HTTP 状态码: 500'));
        assert.strictEqual(signal.disableClear, true);
        assert.strictEqual(mockAppConfig.backends.libretranslate, false);
    });
});
