const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const os = require('node:os');
const fsPromises = require('node:fs/promises');
const ModelDownloader = require('../../modelDownloader');

describe('End to End Download Test', () => {
    it('downloads a small config file from Hugging Face Mirror successfully', async () => {
        // [严格限制] 仅下载极小的配置文件，避免污染网络和大量耗时
        const modelId = 'Xenova/opus-mt-zh-en';
        const testDestDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'helsinki-dl-'));
        const downloader = new ModelDownloader('https://hf-mirror.com');

        // Since we only want a small file and downloadModel() iterates ALL allowed files.
        // We will test `downloadSingleFile` directly to simulate a small isolated segment of the pipeline.

        const files = await downloader.fetchModelMetadata(modelId);
        assert.ok(files.length > 0, 'Should have retrieved file metadata list');

        // Find specifically 'config.json' which is tiny
        const configFile = files.find(f => f.path === 'config.json');
        assert.ok(configFile, 'Config file not found in model tree');

        const targetFilePath = path.join(testDestDir, configFile.path);

        let progressFired = false;
        await downloader.downloadSingleFile(modelId, configFile, targetFilePath, (fileName, downloaded, total, speed) => {
            progressFired = true;
            assert.strictEqual(fileName, 'config.json');
            assert.ok(downloaded > 0, 'Downloaded bytes should be greater than 0');
        });

        assert.strictEqual(progressFired, true, 'Progress callback should have been fired');

        const stat = await fsPromises.stat(targetFilePath);
        assert.ok(stat.size > 0, 'Downloaded file should have content');

        // Final cleanup
        await fsPromises.rm(testDestDir, { recursive: true, force: true });
    });
});
