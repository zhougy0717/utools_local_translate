/**
 * 词典下载管理器单元测试
 */
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { DictDownloader, formatBytes, TEMP_SUFFIX } = require('../src/backends/dict/downloader');
const dictModule = require('../src/backends/dict/index');

describe('DictDownloader', () => {
    let testDir;

    beforeEach(() => {
        // 创建临时测试目录
        testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dict-downloader-test-'));
    });

    afterEach(() => {
        // 清理测试目录
        if (testDir && fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    });

    describe('formatBytes', () => {
        it('should format 0 bytes', () => {
            assert.strictEqual(formatBytes(0), '0 B');
        });

        it('should format bytes correctly', () => {
            assert.strictEqual(formatBytes(1024), '1 KB');
            assert.strictEqual(formatBytes(1024 * 1024), '1 MB');
            assert.strictEqual(formatBytes(1024 * 1024 * 50), '50 MB');
        });

        it('should format with decimal', () => {
            const result = formatBytes(1536);
            assert.ok(result.includes('KB'));
        });
    });

    describe('constructor', () => {
        it('should throw error when destDir is missing', () => {
            assert.throws(() => {
                new DictDownloader({});
            }, /destDir is required/);
        });

        it('should create downloader with valid destDir', () => {
            const downloader = new DictDownloader({ destDir: testDir });
            assert.strictEqual(downloader.destDir, testDir);
        });

        it('should create downloader with proxy', () => {
            const downloader = new DictDownloader({
                destDir: testDir,
                proxy: 'http://127.0.0.1:7890'
            });
            assert.strictEqual(downloader.proxy, 'http://127.0.0.1:7890');
            assert.ok(downloader.agent);
        });

        it('should create destDir if not exists', () => {
            const nestedDir = path.join(testDir, 'nested', 'dir');
            const downloader = new DictDownloader({ destDir: nestedDir });
            assert.ok(fs.existsSync(nestedDir));
        });
    });

    describe('downloadFile', () => {
        it('should have downloadFile method', () => {
            const downloader = new DictDownloader({ destDir: testDir });
            assert.strictEqual(typeof downloader.downloadFile, 'function');
        });

        it('should have downloadEcdict method', () => {
            const downloader = new DictDownloader({ destDir: testDir });
            assert.strictEqual(typeof downloader.downloadEcdict, 'function');
        });

        it('should have downloadCccedict method', () => {
            const downloader = new DictDownloader({ destDir: testDir });
            assert.strictEqual(typeof downloader.downloadCccedict, 'function');
        });

        it('should have downloadAll method', () => {
            const downloader = new DictDownloader({ destDir: testDir });
            assert.strictEqual(typeof downloader.downloadAll, 'function');
        });
    });

    describe('Resume download support', () => {
        it('should export TEMP_SUFFIX constant', () => {
            assert.strictEqual(TEMP_SUFFIX, '.downloading');
        });

        it('should have getDownloadStatus method', () => {
            const downloader = new DictDownloader({ destDir: testDir });
            assert.strictEqual(typeof downloader.getDownloadStatus, 'function');
        });

        it('should have cleanupTempFile method', () => {
            const downloader = new DictDownloader({ destDir: testDir });
            assert.strictEqual(typeof downloader.cleanupTempFile, 'function');
        });

        it('should return none status when no file exists', () => {
            const downloader = new DictDownloader({ destDir: testDir });
            const status = downloader.getDownloadStatus('test.zip');
            assert.strictEqual(status.status, 'none');
            assert.strictEqual(status.downloaded, 0);
        });

        it('should return downloading status when temp file exists', () => {
            const downloader = new DictDownloader({ destDir: testDir });
            const tempPath = path.join(testDir, 'test.zip' + TEMP_SUFFIX);
            fs.writeFileSync(tempPath, Buffer.alloc(1024));

            const status = downloader.getDownloadStatus('test.zip');
            assert.strictEqual(status.status, 'downloading');
            assert.strictEqual(status.downloaded, 1024);
        });

        it('should return completed status when final file exists', () => {
            const downloader = new DictDownloader({ destDir: testDir });
            const destPath = path.join(testDir, 'test.zip');
            fs.writeFileSync(destPath, Buffer.alloc(2048));

            const status = downloader.getDownloadStatus('test.zip');
            assert.strictEqual(status.status, 'completed');
            assert.strictEqual(status.progress, 100);
            assert.strictEqual(status.downloaded, 2048);
        });

        it('should cleanup specific temp file', () => {
            const downloader = new DictDownloader({ destDir: testDir });
            const tempPath = path.join(testDir, 'test.zip' + TEMP_SUFFIX);
            fs.writeFileSync(tempPath, Buffer.alloc(1024));

            assert.ok(fs.existsSync(tempPath));
            downloader.cleanupTempFile('test.zip');
            assert.ok(!fs.existsSync(tempPath));
        });

        it('should cleanup all temp files', () => {
            const downloader = new DictDownloader({ destDir: testDir });
            const tempPath1 = path.join(testDir, 'test1.zip' + TEMP_SUFFIX);
            const tempPath2 = path.join(testDir, 'test2.zip' + TEMP_SUFFIX);
            fs.writeFileSync(tempPath1, Buffer.alloc(1024));
            fs.writeFileSync(tempPath2, Buffer.alloc(1024));

            downloader.cleanupTempFile();
            assert.ok(!fs.existsSync(tempPath1));
            assert.ok(!fs.existsSync(tempPath2));
        });

        it('should skip download if file already exists', async () => {
            const downloader = new DictDownloader({ destDir: testDir });
            const destPath = path.join(testDir, 'test.zip');
            fs.writeFileSync(destPath, Buffer.alloc(1024));

            // 由于需要实际网络请求，这里只测试方法存在和返回结构
            const result = await downloader.downloadFile('http://example.com/test.zip', 'test.zip');
            assert.strictEqual(result.success, true);
            assert.strictEqual(result.skipped, true);
        });
    });
});

describe('DictModule exports', () => {
    it('should export getDictStatus function', () => {
        assert.strictEqual(typeof dictModule.getDictStatus, 'function');
    });

    it('should export DICT_STATUS', () => {
        assert.ok(dictModule.DICT_STATUS);
        assert.strictEqual(dictModule.DICT_STATUS.READY, 'READY');
        assert.strictEqual(dictModule.DICT_STATUS.UNAVAILABLE, 'UNAVAILABLE');
    });

    it('should export downloadDicts function', () => {
        assert.strictEqual(typeof dictModule.downloadDicts, 'function');
    });
});

describe('getDictStatus integration', () => {
    let testDir;

    beforeEach(() => {
        testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dict-status-test-'));
    });

    afterEach(() => {
        if (testDir && fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    });

    it('should return UNAVAILABLE when no dict files exist', () => {
        const { getDictStatus, DICT_STATUS } = dictModule;

        const result = getDictStatus({ resourcePath: testDir });
        assert.strictEqual(result.status, DICT_STATUS.UNAVAILABLE);
    });

    it('should return READY when both dict files exist', () => {
        const { getDictStatus, DICT_STATUS } = dictModule;

        // 创建空的 db 文件模拟已存在的词典
        fs.writeFileSync(path.join(testDir, 'ecdict.db'), '');
        fs.writeFileSync(path.join(testDir, 'cccedict.db'), '');

        const result = getDictStatus({ resourcePath: testDir });
        assert.strictEqual(result.status, DICT_STATUS.READY);
    });

    it('should return UNAVAILABLE when resourcePath is missing', () => {
        const { getDictStatus, DICT_STATUS } = dictModule;

        const result = getDictStatus({});
        assert.strictEqual(result.status, DICT_STATUS.UNAVAILABLE);
        assert.strictEqual(result.path, '');
    });
});
