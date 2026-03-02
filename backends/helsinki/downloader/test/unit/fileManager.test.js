const { describe, it } = require('node:test');
const assert = require('node:assert');
const fsPromises = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { ensureDir, verifyFile } = require('../../fileManager');

describe('FileManager Unit Tests', () => {

    it('ensureDir creates directories successfully', async () => {
        const targetDir = path.join(os.tmpdir(), `helsinki-test-${Date.now()}`, 'nested', 'dir');

        // Assert it does not exist
        await assert.rejects(fsPromises.access(targetDir));

        // Ensure it
        await ensureDir(targetDir);

        // Assert it exists now
        await assert.doesNotReject(fsPromises.access(targetDir));

        // Ensure again should not throw EEXIST
        await assert.doesNotReject(ensureDir(targetDir));

        // Cleanup
        await fsPromises.rm(path.join(os.tmpdir(), targetDir.split(path.sep)[1]), { recursive: true, force: true }).catch(() => { });
    });

    it('verifyFile detects file size match and mismatch correctly', async () => {
        const testFilePath = path.join(os.tmpdir(), `helsinki-test-verify-${Date.now()}.txt`);
        await fsPromises.writeFile(testFilePath, 'dummy data');

        // 10 bytes written string
        assert.strictEqual(await verifyFile(testFilePath, 10), true);

        // Size mismatch
        assert.strictEqual(await verifyFile(testFilePath, 5), false);

        // File not found
        assert.strictEqual(await verifyFile(testFilePath + '.fake'), false);

        // Cleanup
        await fsPromises.rm(testFilePath, { force: true });
    });
});
