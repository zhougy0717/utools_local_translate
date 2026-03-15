/**
 * 词典构建器单元测试
 */
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const zlib = require('zlib');

const { buildEcdict, buildCccedict, buildAllDicts, ECDICT_ZIP, CCCEDICT_ZIP } = require('../src/backends/dict/builder');

describe('DictBuilder', () => {
    let testDir;

    beforeEach(() => {
        // 创建临时测试目录
        testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dict-builder-test-'));
    });

    afterEach(() => {
        // 清理测试目录
        if (testDir && fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    });

    describe('exports', () => {
        it('should export buildEcdict function', () => {
            assert.strictEqual(typeof buildEcdict, 'function');
        });

        it('should export buildCccedict function', () => {
            assert.strictEqual(typeof buildCccedict, 'function');
        });

        it('should export buildAllDicts function', () => {
            assert.strictEqual(typeof buildAllDicts, 'function');
        });

        it('should export constants', () => {
            assert.strictEqual(ECDICT_ZIP, 'ecdict-sqlite-28.zip');
            assert.strictEqual(CCCEDICT_ZIP, 'cedict_1_0_ts_utf-8_mdbg.zip');
        });
    });

    describe('buildAllDicts', () => {
        it('should throw error when repoPath is missing', async () => {
            const result = await buildAllDicts({});
            assert.strictEqual(result.success, false);
            assert.ok(result.error.message.includes('repoPath is required'));
        });

        it('should return success when no zip files exist', async () => {
            const result = await buildAllDicts({ repoPath: testDir });
            assert.strictEqual(result.success, true);
            assert.strictEqual(result.results.length, 0);
        });
    });
});
