const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('assert');
const nock = require('nock');
const { LibreTranslateBackend } = require('../src/backends/libretranslate/index.js');

describe('LibreTranslateBackend', () => {
    let backend;

    beforeEach(() => {
        backend = new LibreTranslateBackend({
            apiBase: 'http://127.0.0.1:5000',
            apiKey: 'test-key'
        });
        
        if (typeof global.fetch !== 'function') {
            global.fetch = require('node-fetch');
        }
    });

    afterEach(() => {
        nock.cleanAll();
    });

    it('should return error if apiBase is not configured', async () => {
        const noConfigBackend = new LibreTranslateBackend({ apiBase: '', apiKey: '' });
        const result = await new Promise((resolve) => {
            noConfigBackend.queryWord('test', 'en', 'zh', (err, res) => resolve(res));
        });
        assert.strictEqual(result.found, false);
        assert.ok(result.message.includes('服务器地址未配置'));
    });

    it('should correctly format payload and return translation on success', async () => {
        const mockResponse = {
            translatedText: '测试翻译结果'
        };

        nock('http://127.0.0.1:5000')
            .post('/translate', body => {
                assert.strictEqual(body.q, 'test');
                assert.strictEqual(body.source, 'en');
                assert.strictEqual(body.target, 'zh');
                assert.strictEqual(body.format, 'text');
                assert.strictEqual(body.api_key, 'test-key');
                return true;
            })
            .reply(200, mockResponse);

        const result = await new Promise((resolve) => {
            backend.queryWord('test', 'en', 'zh', (err, res) => resolve(res));
        });
        assert.strictEqual(result.found, true);
        assert.strictEqual(result.translation, '测试翻译结果');
    });

    it('should handle HTTP error gracefully', async () => {
        nock('http://127.0.0.1:5000')
            .post('/translate')
            .reply(500, 'Internal Server Error');

        const result = await new Promise((resolve) => {
            backend.queryWord('test', 'en', 'zh', (err, res) => resolve(res));
        });
        assert.strictEqual(result.found, false);
        assert.ok(result.message.includes('HTTP 异常状态码: 500'));
    });

    it('should handle 403 error specifically', async () => {
        nock('http://127.0.0.1:5000')
            .post('/translate')
            .reply(403, 'Forbidden');

        const result = await new Promise((resolve) => {
            backend.queryWord('test', 'en', 'zh', (err, res) => resolve(res));
        });
        assert.strictEqual(result.found, false);
        assert.ok(result.message.includes('API Key 无效'));
    });
    
    it('should handle connection refused gracefully', async () => {
        nock('http://127.0.0.1:5000')
            .post('/translate')
            .replyWithError({ message: 'ECONNREFUSED', code: 'ECONNREFUSED' });

        const result = await new Promise((resolve) => {
            backend.queryWord('test', 'en', 'zh', (err, res) => resolve(res));
        });
        assert.strictEqual(result.found, false);
        assert.ok(result.message.includes('无法连接到 LibreTranslate 服务'));
    });
});
