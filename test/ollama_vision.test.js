const test = require('node:test');
const assert = require('node:assert');
const nock = require('nock');
const { OllamaBackend } = require('../src/backends/ollama/index.js');

test('OllamaBackend Vision Support', async (t) => {
    let backend;

    backend = new OllamaBackend({
        apiBase: 'http://127.0.0.1:11434',
        model: 'llava',
        temperature: 0.1
    });
    
    if (typeof global.fetch !== 'function') {
        global.fetch = require('node-fetch');
    }

    t.afterEach(() => {
        nock.cleanAll();
    });

    await t.test('should correctly format vision payload and return results', (t, done) => {
        const mockImageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
        const mockResponse = {
            choices: [
                {
                    message: {
                        content: '识别出的文字：Hello World'
                    }
                }
            ]
        };

        nock('http://127.0.0.1:11434')
            .post('/v1/chat/completions', body => {
                assert.strictEqual(body.model, 'llava');
                const userMessage = body.messages[0];
                assert.ok(Array.isArray(userMessage.content));
                assert.strictEqual(userMessage.content[0].type, 'text');
                assert.ok(userMessage.content[0].text.includes('SOURCE'));
                assert.ok(userMessage.content[0].text.includes('TARGET'));
                assert.strictEqual(userMessage.content[1].type, 'image_url');
                assert.ok(userMessage.content[1].image_url.url.startsWith('data:'));
                assert.strictEqual(userMessage.content[1].image_url.url, mockImageData);
                return true;
            })
            .reply(200, mockResponse);

        backend.queryImage(mockImageData, 'en', (err, result) => {
            try {
                assert.strictEqual(err, null);
                assert.strictEqual(result.found, true);
                assert.ok(result.translation.includes('Hello World'));
                done();
            } catch (e) {
                done(e);
            }
        });
    });

    await t.test('should handle errors when model is not vision-capable (mocking 400)', (t, done) => {
        const mockImageData = 'data:image/png;base64,broken';
        
        nock('http://127.0.0.1:11434')
            .post('/v1/chat/completions')
            .reply(400, { error: { message: 'Model does not support vision' } });

        backend.queryImage(mockImageData, 'zh', (err, result) => {
            try {
                assert.strictEqual(err, null);
                assert.strictEqual(result.found, false);
                assert.ok(result.message.includes('图片解析失败'));
                assert.ok(result.message.includes('视觉能力'));
                done();
            } catch (e) {
                done(e);
            }
        });
    });
});
