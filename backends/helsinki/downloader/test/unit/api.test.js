const { describe, it } = require('node:test');
const assert = require('node:assert');

describe('API Metadata & Exception Tests', () => {

    it('successfully extracts expected file structures from raw metadata dropping useless files', async () => {
        // Build mock for huggingface/hub
        const mockHub = {
            listFiles: async function* (options) {
                yield { path: 'config.json', size: 100 };
                yield { path: 'onnx/model.onnx', size: 500000 };
                yield { path: 'README.md', size: 10 };
                yield { path: 'tokenizer_config.json', size: 200 };
            },
            downloadFile: async (options) => ({ ok: true, headers: { get: () => '1000' }, body: {} })
        };

        // Poison the require cache
        const hubPath = require.resolve('@huggingface/hub');
        require.cache[hubPath] = {
            id: hubPath,
            filename: hubPath,
            loaded: true,
            exports: mockHub
        };

        // Require modelDownloader AFTER poisoning
        const ModelDownloader = require('../../modelDownloader');
        const downloader = new ModelDownloader('https://fake-mirror.com');

        const files = await downloader.fetchModelMetadata('test/model');

        assert.strictEqual(files.length, 3);
        assert.ok(files.find(f => f.path === 'config.json'));
        assert.ok(files.find(f => f.path === 'onnx/model.onnx'));
        assert.ok(!files.find(f => f.path === 'README.md'));

        // Clear cache so it doesn't affect other tests
        delete require.cache[hubPath];
        delete require.cache[require.resolve('../../modelDownloader')];
    });

    it('bubbles up structured exceptions when the Hub network completely fails', async () => {
        const mockHub = {
            listFiles: async function* () {
                throw new Error("DNS resolution failed");
            }
        };

        const hubPath = require.resolve('@huggingface/hub');
        require.cache[hubPath] = {
            id: hubPath,
            filename: hubPath,
            loaded: true,
            exports: mockHub
        };

        const ModelDownloader = require('../../modelDownloader');
        const downloader = new ModelDownloader('https://fake-mirror.com');

        await assert.rejects(
            async () => {
                await downloader.fetchModelMetadata('bad/model')
            },
            (err) => {
                assert.match(err.message, /Failed to fetch metadata for bad\/model: DNS resolution failed/);
                return true;
            }
        );

        delete require.cache[hubPath];
        delete require.cache[require.resolve('../../modelDownloader')];
    });
});
