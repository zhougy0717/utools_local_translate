const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const path = require('node:path');
const { pipeline } = require('node:stream/promises');

/**
 * 确保目录存在
 * @param {string} dirPath 
 */
async function ensureDir(dirPath) {
    try {
        await fsPromises.mkdir(dirPath, { recursive: true });
    } catch (e) {
        if (e.code !== 'EEXIST') {
            throw new Error(`无法创建目录 ${dirPath}: ${e.message}`);
        }
    }
}

/**
 * 将远端下载响应流写入文件
 * @param {Response} response - 原始 fetch 响应
 * @param {string} filePath - 目标落地路径
 * @param {Function} onProgress - 进度回调函数
 */
async function downloadStreamToFile(response, filePath, onProgress) {
    const tmpFilePath = `${filePath}.tmp`;

    try {
        await ensureDir(path.dirname(filePath));

        const totalSize = parseInt(response.headers.get('content-length') || '0', 10);
        let downloadedSize = 0;
        let lastReportedTime = Date.now();
        let bytesSinceLastReport = 0;

        const fileStream = fs.createWriteStream(tmpFilePath);

        // 由于需要统计进度，我们可以插入一个自定义的 Transform (这里为简化用 async iteration / stream node 混搭或通过 response.body 的事件。现代 node 中 response.body 是 ReadableStream (web stream), 可用 Readable.fromWeb)
        // 注意 Node 18+ 内置 fetch 的 response.body 是 Web Stream
        // 将 Web Stream 转为 Node Stream
        const { Readable } = require('node:stream');
        const nodeReadable = Readable.fromWeb(response.body);

        nodeReadable.on('data', (chunk) => {
            downloadedSize += chunk.length;
            bytesSinceLastReport += chunk.length;

            const now = Date.now();
            if (now - lastReportedTime >= 500) { // 每500ms汇报一次进度
                const timeDiff = (now - lastReportedTime) / 1000;
                const speed = bytesSinceLastReport / timeDiff; // B/s
                if (onProgress) {
                    onProgress({
                        fileName: path.basename(filePath),
                        downloaded: downloadedSize,
                        total: totalSize,
                        speed: speed
                    });
                }
                lastReportedTime = now;
                bytesSinceLastReport = 0;
            }
        });

        // 管道式写入以防止溢出
        await pipeline(nodeReadable, fileStream);

        // 如果未出错，将其由 tmp 变为正式文件
        await fsPromises.rename(tmpFilePath, filePath);

        // 结束时触发一次满进度
        if (onProgress) {
            onProgress({
                fileName: path.basename(filePath),
                downloaded: downloadedSize,
                total: totalSize || downloadedSize,
                speed: 0
            });
        }
    } catch (error) {
        // 下载途中失败，清理临时文件
        try {
            await fsPromises.rm(tmpFilePath, { force: true });
        } catch (rmError) {
            // ignore cleanup error
        }
        throw error;
    }
}

/**
 * 简单校验文件是否存在以及是否有体积
 * @param {string} filePath
 * @param {number} expectedSize - (可选) 期望的大小，部分 api 可能无法提供
 * @returns {Promise<boolean>}
 */
async function verifyFile(filePath, expectedSize = 0) {
    try {
        const stat = await fsPromises.stat(filePath);
        if (stat.size === 0) return false;
        if (expectedSize > 0 && stat.size !== expectedSize) return false;
        return true;
    } catch (e) {
        return false;
    }
}

module.exports = {
    ensureDir,
    downloadStreamToFile,
    verifyFile
};
