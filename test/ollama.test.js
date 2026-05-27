const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('assert');
const nock = require('nock');
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
        noModelBackend.queryWord('test', 'zh', (err, result) => {
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

        backend.queryWord('test', 'zh', (err, result) => {
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

        backend.queryWord('test', 'zh', (err, result) => {
            assert.strictEqual(err, null);
            assert.strictEqual(result.found, false);
            assert.ok(result.message.includes('API 请求失败'));
            done();
        });
    });
    
    it('should handle connection refused gracefuly', (t, done) => {
        nock('http://127.0.0.1:11434')
            .post('/v1/chat/completions')
            .replyWithError(new Error('ECONNREFUSED'));

        backend.queryWord('test', 'zh', (err, result) => {
            assert.strictEqual(err, null);
            assert.strictEqual(result.found, false);
            assert.ok(result.message.includes('无法连接到 Ollama 服务'));
            done();
        });
    });

    it('should respect sslVerify settings in request options', async () => {
        const https = require('https');
        const originalRequest = https.request;
        let capturedOptions = null;
        https.request = (url, options, callback) => {
            const opts = typeof url === 'string' || url instanceof URL ? options : url;
            capturedOptions = opts;
            return originalRequest(url, options, callback);
        };

        try {
            // Case 1: sslVerify is false
            const sslBackend = new OllamaBackend({
                apiBase: 'https://127.0.0.1:11434/v1',
                model: 'test-model',
                sslVerify: false
            });
            
            nock('https://127.0.0.1:11434')
                .post('/v1/chat/completions')
                .reply(200, { choices: [{ message: { content: 'test' } }] });

            await new Promise((resolve) => {
                sslBackend.queryWord('test', 'zh', resolve);
            });

            assert.ok(capturedOptions);
            assert.strictEqual(capturedOptions.rejectUnauthorized, false);

            // Case 2: sslVerify is true (default)
            const sslDefaultBackend = new OllamaBackend({
                apiBase: 'https://127.0.0.1:11434/v1',
                model: 'test-model'
            });

            nock('https://127.0.0.1:11434')
                .post('/v1/chat/completions')
                .reply(200, { choices: [{ message: { content: 'test' } }] });

            await new Promise((resolve) => {
                sslDefaultBackend.queryWord('test', 'zh', resolve);
            });

            assert.ok(capturedOptions);
            assert.strictEqual(capturedOptions.rejectUnauthorized, true);
        } finally {
            https.request = originalRequest;
        }
    });
});
