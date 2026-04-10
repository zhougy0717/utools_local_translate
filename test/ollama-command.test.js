const { describe, it, test, beforeEach, afterEach } = require('node:test');
const assert = require('assert');
const ollamaCommand = require('../src/commands/ollama.js');

describe('Ollama Command Manager', () => {
    it('should show not configured status when model is empty', () => {
        let listItems = null;
        const callbackSetList = (items) => {
            listItems = items;
        };
        const appConfig = {
            ollama: {}
        };

        ollamaCommand.handleSearch('/ollama', callbackSetList, appConfig);

        assert.ok(listItems);
        assert.strictEqual(listItems.length, 1);
        assert.ok(listItems[0].description.includes('未配置完全'));
        assert.strictEqual(listItems[0].actionType, 'open_panel');
    });

    it('should show current configured model', () => {
        let listItems = null;
        const callbackSetList = (items) => {
            listItems = items;
        };
        const appConfig = {
            ollama: {
                apiBase: 'http://test',
                model: 'llama3:latest'
            }
        };

        ollamaCommand.handleSearch('/ollama', callbackSetList, appConfig);

        assert.ok(listItems);
        assert.ok(listItems[0].description.includes('llama3:latest'));
    });

    it('should return openOllamaConfigPanel signal on select', () => {
        const itemData = {
            isCommandContext: true,
            actionType: 'open_panel'
        };

        const result = ollamaCommand.handleSelect(itemData, {}, () => {});
        assert.strictEqual(result.openOllamaConfigPanel, true);
        assert.strictEqual(result.disableClear, true);
    });
});
