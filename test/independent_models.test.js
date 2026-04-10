const test = require('node:test');
const assert = require('node:assert');
const nock = require('nock');
const { OllamaBackend } = require('../src/backends/ollama/index.js');

test('OllamaBackend Independent Model Selection', async (t) => {
    if (typeof global.fetch !== 'function') {
        global.fetch = require('node-fetch');
    }

    t.afterEach(() => {
        nock.cleanAll();
    });

    await t.test('queryWord should use primary model', (t, done) => {
        const backend = new OllamaBackend({
            apiBase: 'http://127.0.0.1:11434/v1',
            model: 'text-model-a',
            visionModel: 'vision-model-b'
        });

        nock('http://127.0.0.1:11434')
            .post('/v1/chat/completions', body => {
                assert.strictEqual(body.model, 'text-model-a');
                return true;
            })
            .reply(200, { choices: [{ message: { content: 'translated text' } }] });

        backend.queryWord('hello', 'en', 'zh', (err, result) => {
            try {
                assert.strictEqual(result.translation, 'translated text');
                done();
            } catch (e) {
                done(e);
            }
        });
    });

    await t.test('queryImage should prefer visionModel', (t, done) => {
        const backend = new OllamaBackend({
            apiBase: 'http://127.0.0.1:11434/v1',
            model: 'text-model-a',
            visionModel: 'vision-model-b'
        });

        nock('http://127.0.0.1:11434')
            .post('/v1/chat/completions', body => {
                assert.strictEqual(body.model, 'vision-model-b');
                return true;
            })
            .reply(200, { choices: [{ message: { content: 'SOURCE: hello TARGET: 你好' } }] });

        backend.queryImage('data:image/png;base64,xxx', 'zh', (err, result) => {
            try {
                assert.strictEqual(backend.config.visionModel, 'vision-model-b');
                done();
            } catch (e) {
                done(e);
            }
        });
    });

    await t.test('queryImage should fallback to model if visionModel is empty', (t, done) => {
        const backend = new OllamaBackend({
            apiBase: 'http://127.0.0.1:11434/v1',
            model: 'dual-purpose-model',
            visionModel: ''
        });

        nock('http://127.0.0.1:11434')
            .post('/v1/chat/completions', body => {
                assert.strictEqual(body.model, 'dual-purpose-model');
                return true;
            })
            .reply(200, { choices: [{ message: { content: 'SOURCE: hello TARGET: 你好' } }] });

        backend.queryImage('data:image/png;base64,xxx', 'zh', (err, result) => {
            try {
                done();
            } catch (e) {
                done(e);
            }
        });
    });

    await t.test('checkVisionCapability should use visionModel or model', async (t) => {
        const backend = new OllamaBackend({
            apiBase: 'http://127.0.0.1:11434/v1',
            model: 'text-model',
            visionModel: 'vision-model'
        });

        // Mocking /api/show (Ollama native API)
        nock('http://127.0.0.1:11434')
            .post('/api/show', body => {
                assert.strictEqual(body.name, 'vision-model');
                return true;
            })
            .reply(200, { projector: 'exists' });

        const result = await backend.checkVisionCapability();
        assert.strictEqual(result.supported, true);
    });
});
