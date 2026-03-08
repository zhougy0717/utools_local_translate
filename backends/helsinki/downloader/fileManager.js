const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const path = require('node:path');

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

        // 兼容性方案：直接通过 W3C ReadableStream Reader 手动读取数据块并写入 Node.js WriteStream
        // 避免使用 Readable.fromWeb()（Node.js v17+ 才支持），以兼容 uTools 内置的 Node 环境
        const reader = response.body.getReader();

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                // value 是 Uint8Array，Buffer 已经能识别
                const chunk = Buffer.from(value);
                downloadedSize += chunk.length;
                bytesSinceLastReport += chunk.length;

                // 写入文件，如果缓冲区满则等待排空（背压处理）
                const canContinue = fileStream.write(chunk);
                if (!canContinue) {
                    await new Promise(resolve => fileStream.once('drain', resolve));
                }

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
            }
        } finally {
            reader.releaseLock();
        }

        // 关闭写入流
        await new Promise((resolve, reject) => {
            fileStream.end((err) => err ? reject(err) : resolve());
        });

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
