const fs = require('fs');
const path = require('path');
const readline = require('readline');
const AdmZip = require('adm-zip');
const initSqlJs = require('sql.js');

/**
 * 构建/提取中翻英词典数据库
 * @param {string} sourceZipPath - zip 文件的绝对路径 e.g. /path/to/cedict_1_0_ts_utf-8_mdbg.zip
 * @param {string} targetDir - 期望将 db 提取到的目标目录 e.g. /path/to/resources
 * @param {function(string)} onProgress - 进度回调函数
 * @returns {Promise<void>}
 */
async function buildCccedict(sourceZipPath, targetDir, onProgress) {
    return new Promise((resolve, reject) => {
        try {
            if (!fs.existsSync(sourceZipPath)) {
                return reject(new Error('未找到 cccedict 压缩包文件'));
            }

            onProgress('开始读取 cccedict 压缩包...');

            // 使用 setTimeout 避免在主线程中阻塞 UI 的初次渲染
            setTimeout(async () => {
                try {
                    const zip = new AdmZip(sourceZipPath);
                    const zipEntries = zip.getEntries();

                    let txtEntry = null;
                    onProgress('正在查找 cccedict 文本文件...');

                    for (const entry of zipEntries) {
                        if (!entry.isDirectory && entry.entryName.endsWith('cedict_ts.u8')) {
                            txtEntry = entry;
                            break;
                        }
                    }

                    if (!txtEntry) {
                        return reject(new Error('压缩包内未找到 cedict_ts.u8 文件'));
                    }

                    onProgress(`发现文本文件 ${txtEntry.entryName}，开始解压提取...`);
                    zip.extractEntryTo(txtEntry, targetDir, false, true);
                    const extractedPath = path.join(targetDir, path.basename(txtEntry.entryName));

                    onProgress('启动 SQL 引擎创建数据库表...');
                    const SQL = await initSqlJs();
                    const db = new SQL.Database();

                    db.exec("CREATE TABLE cccedict (traditional TEXT, simplified TEXT, pinyin TEXT, english TEXT);");
                    // 开启事务以提升写入性能
                    db.exec("BEGIN TRANSACTION;");

                    const stmt = db.prepare("INSERT INTO cccedict VALUES (?,?,?,?)");

                    onProgress('正在解析并生成数据库 (0%)...');

                    const stat = fs.statSync(extractedPath);
                    const totalBytes = stat.size;
                    let parsedBytes = 0;
                    let lastPercent = 0;

                    const rl = readline.createInterface({
                        input: fs.createReadStream(extractedPath),
                        crlfDelay: Infinity
                    });

                    rl.on('line', (line) => {
                        parsedBytes += Buffer.byteLength(line, 'utf8') + 1; // +1 for newline approximation

                        const currentPercent = Math.floor((parsedBytes / totalBytes) * 100);
                        if (currentPercent > lastPercent && currentPercent % 5 === 0) {
                            lastPercent = currentPercent;
                            onProgress(`正在解析并生成数据库 (${currentPercent}%)...`);
                        }

                        const trimLine = line.trim();
                        if (!trimLine || trimLine.startsWith('#')) return;

                        // 格式: Traditional Simplified [pin yin] /English 1/English 2/
                        const match = trimLine.match(/^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+\/(.+)\/$/);
                        if (match) {
                            stmt.run([match[1], match[2], match[3], match[4]]);
                        }
                    });

                    rl.on('close', () => {
                        onProgress(`数据解析完成，正在建立索引并导出数据库 (可能十分耗时，请耐心等待)...`);

                        // Let the UI render the progress message before taking the CPU heavy hit
                        setTimeout(() => {
                            try {
                                stmt.free();
                                db.exec("CREATE INDEX idx_cccedict_simplified ON cccedict(simplified);");
                                db.exec("CREATE INDEX idx_cccedict_traditional ON cccedict(traditional);");
                                db.exec("COMMIT;");

                                const data = db.export();
                                const buffer = Buffer.from(data);
                                db.close();

                                const finalDbPath = path.join(targetDir, 'cccedict.db');
                                fs.writeFileSync(finalDbPath, buffer);

                                onProgress(`数据库构建成功，正在清理临时文件和压缩包...`);
                                fs.unlinkSync(extractedPath);
                                fs.unlinkSync(sourceZipPath);

                                onProgress(`清理完毕！cccedict 处理完成！`);
                                resolve();
                            } catch (err) {
                                reject(err);
                            }
                        }, 50);
                    });

                    rl.on('error', (err) => {
                        reject(err);
                    });

                } catch (e) {
                    reject(e);
                }
            }, 100);

        } catch (e) {
            reject(e);
        }
    });
}

module.exports = {
    buildCccedict
};
