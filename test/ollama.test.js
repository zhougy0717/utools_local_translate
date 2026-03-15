const assert = require('assert');
const nock = require('nock'); // Need to install nock for mocking HTTP requests
const { OllamaBackend } = require('../../src/backends/ollama/index.js');

describe('OllamaBackend', () => {
    let backend;

    beforeEach(() => {
        backend = new OllamaBackend({
            apiBase: 'http://127.0.0.1:11434/v1',
            model: 'test-model',
            prompt: 'Translate to ${target_lang}:',
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

    it('should return error if model is not configured', (done) => {
        const noModelBackend = new OllamaBackend({ apiBase: 'http://test', model: '' });
        noModelBackend.queryWord('test', 'en', 'zh', (err, result) => {
            assert.strictEqual(err, null);
            assert.strictEqual(result.found, false);
            assert.ok(result.message.includes('未配置'));
            done();
        });
    });

    it('should correctly format payload and return translation on success', (done) => {
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
            .post('/v1/chat/completions', body => {
                assert.strictEqual(body.model, 'test-model');
                assert.strictEqual(body.temperature, 0.1);
                assert.strictEqual(body.messages[0].role, 'system');
                assert.strictEqual(body.messages[0].content, 'Translate to 中文:');
                assert.strictEqual(body.messages[1].role, 'user');
                assert.strictEqual(body.messages[1].content, 'test');
                return true;
            })
            .reply(200, mockResponse);

        backend.queryWord('test', 'en', 'zh', (err, result) => {
            assert.strictEqual(err, null);
            assert.strictEqual(result.found, true);
            assert.strictEqual(result.translation, '测试翻译结果');
            done();
        });
    });

    it('should handle HTTP error gracefully', (done) => {
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
    
    it('should handle connection refused gracefuly', (done) => {
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
