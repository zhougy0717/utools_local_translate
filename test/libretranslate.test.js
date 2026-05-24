const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('assert');
const nock = require('nock');
const { LibreTranslateBackend } = require('../src/backends/libretranslate/index.js');

describe('LibreTranslateBackend Unified Config', () => {
    let backend;

    beforeEach(() => {
        backend = new LibreTranslateBackend({
            apiBase: 'http://127.0.0.1:5000',
            apiKey: 'test-key',
            sourceLang: 'en',
            targetLang: 'zh'
        });
        
        if (typeof global.fetch !== 'function') {
            global.fetch = require('node-fetch');
        }
    });

    afterEach(() => {
        nock.cleanAll();
    });

    it('should use default languages from config if not provided in queryWord', async () => {
        const mockResponse = {
            translatedText: '测试翻译结果'
        };

        nock('http://127.0.0.1:5000')
            .post('/translate', body => {
                // Since detector detects 'test' as 'en' and targetOverride is null
                assert.strictEqual(body.source, 'en');
                assert.strictEqual(body.target, 'zh');
                return true;
            })
            .reply(200, mockResponse);

        const result = await new Promise((resolve) => {
            // Passing targetOverride as null (falls back to default/detected)
            backend.queryWord('test', null, (err, res) => resolve(res));
        });
        assert.strictEqual(result.found, true);
    });

    it('should prioritize passed parameters over config defaults', async () => {
        nock('http://127.0.0.1:5000')
            .post('/translate', body => {
                assert.strictEqual(body.source, 'en'); // 'test' detected as 'en'
                assert.strictEqual(body.target, 'de'); // targetOverride is 'de'
                return true;
            })
            .reply(200, { translatedText: 'french to german' });

        await new Promise((resolve) => {
            backend.queryWord('test', 'de', (err, res) => resolve(res));
        });
    });

    it('should correctly handle 403 error', async () => {
        nock('http://127.0.0.1:5000')
            .post('/translate')
            .reply(403, 'Forbidden');

        const result = await new Promise((resolve) => {
            backend.queryWord('test', 'zh', (err, res) => resolve(res));
        });
        assert.strictEqual(result.found, false);
        assert.ok(result.message.includes('API Key 无效'));
    });

    it('should handle connection refused gracefully', async () => {
        nock('http://127.0.0.1:5000')
            .post('/translate')
            .replyWithError(new Error('ECONNREFUSED'));

        const result = await new Promise((resolve) => {
            backend.queryWord('test', 'zh', (err, res) => resolve(res));
        });
        assert.strictEqual(result.found, false);
        assert.ok(result.message.includes('无法连接到 LibreTranslate 服务'));
    });
});
