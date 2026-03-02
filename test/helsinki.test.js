const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { createHelsinkiBackend } = require('../backends/helsinki/helsinki.js');

test('Helsinki Backend - Normal translation (en to zh)', async (t) => {
    const backend = createHelsinkiBackend();
    const res = await new Promise((resolve) => {
        backend.queryWord('hello', 'en', 'zh', (err, result) => {
            if (err) resolve({ error: err });
            else resolve(result);
        });
    });

    if (!res.found) console.log('en->zh error message:', res.message);
    assert.ok(res.found === true, 'Should find translation');
    assert.ok(typeof res.translation === 'string', 'Translation should be a string');
    assert.ok(res.translation.length > 0, 'Translation should not be empty');
});

test('Helsinki Backend - Normal translation (zh to en)', async (t) => {
    const backend = createHelsinkiBackend();
    const res = await new Promise((resolve) => {
        backend.queryWord('你好', 'zh', 'en', (err, result) => {
            if (err) resolve({ error: err });
            else resolve(result);
        });
    });

    if (!res.found) console.log('zh->en error message:', res.message);
    assert.ok(res.found === true, 'Should find translation');
    assert.ok(typeof res.translation === 'string', 'Translation should be a string');
    assert.ok(res.translation.length > 0, 'Translation should not be empty');
});

test('Helsinki Backend - Missing model archive', async (t) => {
    const backend = createHelsinkiBackend({
        modelArchivePath: path.join(__dirname, 'not_exist.tar.gz'),
        modelDir: path.join(__dirname, 'not_exist_dir')
    });

    const res = await new Promise((resolve) => {
        backend.queryWord('test', 'en', 'zh', (err, result) => {
            if (err) resolve({ error: err });
            else resolve(result);
        });
    });

    assert.ok(res.found === false, 'Should return found: false');
    assert.ok(!!res.message, 'Should have a message explaining failure');
});
