const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const cccedictBuilder = require('./cccedictBuilder');

/**
 * 构建/提取词典数据库
 * @param {string} sourceZipPath - zip 文件的绝对路径 e.g. /path/to/ecdict-sqlite-28.zip
 * @param {string} targetDir - 期望将 db 提取到的目标目录 e.g. /path/to/resources
 * @param {function(string)} onProgress - 进度回调函数
 * @returns {Promise<void>}
 */
async function build(sourceZipPath, targetDir, onProgress) {
    return new Promise((resolve, reject) => {
        try {
            if (!fs.existsSync(sourceZipPath)) {
                return reject(new Error('未找到词典压缩包文件'));
            }

            onProgress('开始读取压缩包...');

            // 使用 setTimeout 避免在主线程中阻塞 UI 的初次渲染
            setTimeout(() => {
                try {
                    const zip = new AdmZip(sourceZipPath);
                    const zipEntries = zip.getEntries();

                    let dbEntry = null;
                    onProgress('正在查找数据库文件...');

                    for (const entry of zipEntries) {
                        if (!entry.isDirectory && (entry.entryName.endsWith('ecdict.db') || entry.entryName.endsWith('stardict.db'))) {
                            dbEntry = entry;
                            break;
                        }
                    }

                    if (!dbEntry) {
                        return reject(new Error('压缩包内未找到 ecdict.db 或 stardict.db 文件'));
                    }

                    onProgress(`发现数据库文件 ${dbEntry.entryName}，开始解压提取 (可能需要数分钟，请耐心等待)...`);

                    // 使用 extractEntryTo 提取，若 extractEntryTo 会阻塞，
                    // 可考虑再次包装 setTimeout 或 process.nextTick。
                    // 参数： entryName, targetPath, maintainEntryPath, overwrite
                    zip.extractEntryTo(dbEntry, targetDir, false, true);

                    // 如果提取出来的是 stardict.db，重命名为 ecdict.db
                    const extractedPath = path.join(targetDir, path.basename(dbEntry.entryName));
                    const finalDbPath = path.join(targetDir, 'ecdict.db');

                    if (extractedPath !== finalDbPath) {
                        onProgress(`数据库文件已提取，正在重命名...`);
                        fs.renameSync(extractedPath, finalDbPath);
                    }

                    onProgress(`数据库构建成功，正在清理原始压缩包...`);
                    fs.unlinkSync(sourceZipPath);

                    onProgress(`清理完毕！处理完成！`);
                    resolve();

                } catch (e) {
                    reject(e);
                }
            }, 100);

        } catch (e) {
            reject(e);
        }
    });
}

async function buildAll(extInfo, onProgress) {
    const targetDir = extInfo.path;
    if (extInfo.eZipPath) {
        onProgress('开始处理 ecdict 词典 (英文)...');
        await build(extInfo.eZipPath, targetDir, onProgress);
    }
    if (extInfo.cZipPath) {
        onProgress('开始处理 cccedict 词典 (中文)...');
        await cccedictBuilder.buildCccedict(extInfo.cZipPath, targetDir, onProgress);
    }
}

module.exports = {
    build,
    buildAll
};
