const { describe, it, test, beforeEach, afterEach } = require('node:test');
const assert = require('assert');
const nock = require('nock'); // Need to install nock for mocking HTTP requests
const { OllamaBackend } = require('../src/backends/ollama/index.js');

describe('OllamaBackend', () => {
    let backend;

    beforeEach(() => {
        backend = new OllamaBackend({
            apiBase: 'http://127.0.0.1:11434/v1',
            model: 'test-model',
            prompt: 'Translate to [TARGET_LANG]:',
            temperature: 0.1
        });
        
        // Mock global fetch for Node environment if it doesn't exist natively
        if (typeof global.fetch !== 'function') {
            global.fetch = require('node-fetch');
        }
    });

    afterEach(() => {
        nock.cleanAll();
    });

    it('isConfigured should return true if model is set', () => {
        const b = new OllamaBackend({ model: 'phi3' });
        assert.strictEqual(b.isConfigured(), true);
    });

    it('isConfigured should return false if model is missing', () => {
        const b = new OllamaBackend({ model: '' });
        assert.strictEqual(b.isConfigured(), false);
    });

    it('should return error if model is not configured', (t, done) => {
        const noModelBackend = new OllamaBackend({ apiBase: 'http://test', model: '' });
        noModelBackend.queryWord('test', 'en', 'zh', (err, result) => {
            assert.strictEqual(err, null);
            assert.strictEqual(result.found, false);
            assert.ok(result.message.includes('未配置'));
            done();
        });
    });

    it('should correctly format payload and return translation on success', (t, done) => {
        const mockResponse = {
            choices: [
                {
                    message: {
                        content: '  测试翻译结果  '
                    }
                }
            ]
        };

        nock('http://127.0.0.1:11434')
            .post('/v1/chat/completions')
            .reply(200, mockResponse);

        backend.queryWord('test', 'en', 'zh', (err, result) => {
            assert.strictEqual(err, null);
            assert.strictEqual(result.found, true);
            assert.strictEqual(result.translation, '测试翻译结果');
            done();
        });
    });

    it('should handle HTTP error gracefully', (t, done) => {
        nock('http://127.0.0.1:11434')
            .post('/v1/chat/completions')
            .reply(500, 'Internal Server Error');

        backend.queryWord('test', 'en', 'zh', (err, result) => {
            assert.strictEqual(err, null);
            assert.strictEqual(result.found, false);
            assert.ok(result.message.includes('API 请求失败'));
            done();
        });
    });
    
    it('should handle connection refused gracefuly', (t, done) => {
        nock('http://127.0.0.1:11434')
            .post('/v1/chat/completions')
            .replyWithError({ message: 'ECONNREFUSED', code: 'ECONNREFUSED' });

        backend.queryWord('test', 'en', 'zh', (err, result) => {
            assert.strictEqual(err, null);
            assert.strictEqual(result.found, false);
            assert.ok(result.message.includes('无法连接到 Ollama 服务'));
            done();
        });
    });
});
