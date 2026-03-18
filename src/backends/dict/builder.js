/**
 * 词典构建器
 * 解压下载的 zip 文件并构建 SQLite 数据库
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { promisify } = require('util');
const { execSync } = require('child_process');

const gunzip = promisify(zlib.gunzip);

/**
 * 检查系统是否安装了 sqlite3 命令行工具
 * @returns {boolean}
 */
function hasSqlite3Cli() {
  try {
    execSync('sqlite3 --version', { stdio: 'pipe' });
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * 使用 sqlite3 命令行工具创建 CC-CEDICT 数据库
 * @param {Array} entries 词典条目数组
 * @param {string} dbPath 数据库文件路径
 */
function createCccedictDbWithCli(entries, dbPath) {
  // 如果数据库已存在，先删除
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }

  // 使用事务大幅提升速度，并准备基础结构
  const setupSql = [
    `CREATE TABLE cccedict (simplified TEXT, traditional TEXT, pinyin TEXT, english TEXT);`,
    `CREATE INDEX idx_cccedict_s ON cccedict(simplified);`,
    `CREATE INDEX idx_cccedict_t ON cccedict(traditional);`,
    `BEGIN TRANSACTION;`
  ].join('\n');

  // 分批生成 SQL 以兼顾内存，但最终统一通过 stdin 传入
  const batchSize = 500;
  const insertStatements = [];
  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize);
    const values = batch.map(e =>
      `('${e.simplified.replace(/'/g, "''")}', '${e.traditional.replace(/'/g, "''")}', '${e.pinyin.replace(/'/g, "''")}', '${e.english.replace(/'/g, "''")}')`
    ).join(',');

    insertStatements.push(`INSERT INTO cccedict (simplified, traditional, pinyin, english) VALUES ${values};`);
  }

  const finalSql = setupSql + '\n' + insertStatements.join('\n') + '\nCOMMIT;';

  // 将 SQL 写出临时文件，通过 .read 解决 Windows 下可能出现的命令行加参数长或编码问题
  const tempSqlFile = dbPath + '.temp.sql';
  fs.writeFileSync(tempSqlFile, finalSql, 'utf8');

  try {
    // 使用 .read 能够更稳妥地导入数据，支持 UTF-8
    // 将路径分隔符转换为 /，避免被部分 sqlite3 版本将 \ 当作转义
    const safeTempSqlFile = tempSqlFile.replace(/\\/g, '/').replace(/'/g, "''");
    execSync(`sqlite3 "${dbPath}" ".read '${safeTempSqlFile}'"`);
  } catch (e) {
    console.error('SQLite CLI insert failed:', e.message);
    throw e;
  } finally {
    if (fs.existsSync(tempSqlFile)) {
      fs.unlinkSync(tempSqlFile);
    }
  }
}

// 下载文件名称
const ECDICT_ZIP = 'ecdict-sqlite-28.zip';
const CCCEDICT_ZIP = 'cedict_1_0_ts_utf-8_mdbg.zip';

// 目标数据库文件名
const ECDICT_DB = 'ecdict.db';
const CCCEDICT_DB = 'cccedict.db';

/**
 * 简单的 ZIP 解压（仅支持存储和 deflate 压缩）
 * @param {Buffer} zipBuffer ZIP 文件内容
 * @param {string} destDir 目标目录
 * @returns {Promise<Array<{name: string, path: string}>>} 解压后的文件列表
 */
async function unzip(zipBuffer, destDir) {
  const files = [];
  let pos = 0;

  // 读取本地文件头
  while (pos < zipBuffer.length - 30) {
    // 本地文件头签名: 0x04034b50
    const signature = zipBuffer.readUInt32LE(pos);
    if (signature !== 0x04034b50) {
      break;
    }

    const version = zipBuffer.readUInt16LE(pos + 4);
    const flags = zipBuffer.readUInt16LE(pos + 6);
    const compression = zipBuffer.readUInt16LE(pos + 8);
    const compressedSize = zipBuffer.readUInt32LE(pos + 18);
    const uncompressedSize = zipBuffer.readUInt32LE(pos + 22);
    const nameLength = zipBuffer.readUInt16LE(pos + 26);
    const extraLength = zipBuffer.readUInt16LE(pos + 28);

    const name = zipBuffer.slice(pos + 30, pos + 30 + nameLength).toString('utf8');
    const dataStart = pos + 30 + nameLength + extraLength;
    const compressedData = zipBuffer.slice(dataStart, dataStart + compressedSize);

    // 跳过目录条目
    if (!name.endsWith('/')) {
      let fileData;
      if (compression === 0) {
        fileData = compressedData;
      } else if (compression === 8) {
        fileData = zlib.inflateRawSync(compressedData);
      } else {
        throw new Error(`不支持的压缩方法: ${compression}`);
      }

      const destPath = path.join(destDir, name);
      // 确保父目录存在
      const fileDir = path.dirname(destPath);
      if (!fs.existsSync(fileDir)) {
        fs.mkdirSync(fileDir, { recursive: true });
      }

      fs.writeFileSync(destPath, fileData);
      files.push({ name, path: destPath, size: fileData.length });
    }

    pos = dataStart + compressedSize;
  }

  return files;
}

/**
 * 流式合并分卷文件 (spec-00024)
 * @param {string[]} volumePaths 分卷文件路径列表（需按序号排列）
 * @param {string} outputPath 合并后的目标文件路径
 * @returns {Promise<string>} 成功返回目标路径
 */
function mergeVolumes(volumePaths, outputPath) {
  return new Promise((resolve, reject) => {
    const writeStream = fs.createWriteStream(outputPath);
    let currentIdx = 0;

    function mergeNext() {
      if (currentIdx >= volumePaths.length) {
        writeStream.end();
        return;
      }

      const readStream = fs.createReadStream(volumePaths[currentIdx]);
      readStream.pipe(writeStream, { end: false });

      readStream.on('end', () => {
        currentIdx++;
        mergeNext();
      });

      readStream.on('error', (err) => {
        writeStream.destroy();
        reject(err);
      });
    }

    writeStream.on('finish', () => {
      resolve(outputPath);
    });

    writeStream.on('error', (err) => {
      reject(err);
    });

    mergeNext();
  });
}

/**
 * 构建 ECDICT 数据库
 * ECDICT 的 zip 中直接包含 ecdict.db，只需解压
 * @param {string} zipPath zip 文件路径
 * @param {string} destDir 目标目录
 * @param {Function} onProgress 进度回调
 * @returns {Promise<{success: boolean, dbPath: string, error?: Error}>}
 */
async function buildEcdict(zipPath, destDir, onProgress) {
  try {
    if (onProgress) onProgress('解压 ECDICT...', 10);

    const zipBuffer = fs.readFileSync(zipPath);
    const files = await unzip(zipBuffer, destDir);

    if (onProgress) onProgress('查找数据库文件...', 50);

    // 查找 .db 文件
    const dbFile = files.find(f => f.name.endsWith('.db'));
    if (!dbFile) {
      return {
        success: false,
        dbPath: '',
        error: new Error('ECDICT zip 中未找到 .db 文件')
      };
    }

    if (onProgress) onProgress('重命名数据库文件...', 80);

    // 重命名为标准名称
    const targetPath = path.join(destDir, ECDICT_DB);
    if (dbFile.path !== targetPath) {
      if (fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath);
      }
      fs.renameSync(dbFile.path, targetPath);
    }

    // 删除 zip 文件
    fs.unlinkSync(zipPath);

    if (onProgress) onProgress('完成', 100);

    return {
      success: true,
      dbPath: targetPath
    };
  } catch (err) {
    return {
      success: false,
      dbPath: '',
      error: err
    };
  }
}

/**
 * 解析 CC-CEDICT 行
 * @param {string} line 一行文本
 * @returns {{traditional: string, simplified: string, pinyin: string, english: string} | null}
 */
function parseCccedictLine(line) {
  line = line.trim();
  if (!line || line.startsWith('#')) {
    return null;
  }

  // 格式: 繁体 简体 [拼音] /英文释义1/释义2/
  const match = line.match(/^(\S+)\s+(\S+)\s+\[([^\]]*)\]\s+\/(.+)\/\s*$/);
  if (!match) {
    return null;
  }

  const [, traditional, simplified, pinyin, rest] = match;
  const english = rest ? rest.replace(/\//g, '; ').trim() : '';

  return { traditional, simplified, pinyin, english };
}

/**
 * 构建 CC-CEDICT 数据库
 * CC-CEDICT 的 zip 中包含文本文件，需要解析并转换为 SQLite
 * @param {string} zipPath zip 文件路径
 * @param {string} destDir 目标目录
 * @param {Function} onProgress 进度回调
 * @returns {Promise<{success: boolean, dbPath: string, error?: Error}>}
 */
async function buildCccedict(zipPath, destDir, onProgress) {
  try {
    if (onProgress) onProgress('解压 CC-CEDICT...', 10);

    const zipBuffer = fs.readFileSync(zipPath);
    const files = await unzip(zipBuffer, destDir);

    if (onProgress) onProgress('查找文本文件...', 30);

    // 查找文本文件（.txt 或 .u8）
    const txtFile = files.find(f =>
      f.name.endsWith('.txt') ||
      f.name.endsWith('.u8') ||
      f.name.toLowerCase().includes('cedict')
    );

    if (!txtFile) {
      return {
        success: false,
        dbPath: '',
        error: new Error('CC-CEDICT zip 中未找到文本文件')
      };
    }

    if (onProgress) onProgress('读取词典数据...', 40);

    // 读取并解压（如果是 gz）
    let content;
    const fileBuffer = fs.readFileSync(txtFile.path);

    if (txtFile.path.endsWith('.gz')) {
      content = (await gunzip(fileBuffer)).toString('utf8');
    } else {
      content = fileBuffer.toString('utf8');
    }

    if (onProgress) onProgress('解析词典数据...', 50);

    // 解析行
    const lines = content.split('\n');
    const entries = [];
    for (const line of lines) {
      const entry = parseCccedictLine(line);
      if (entry) {
        entries.push(entry);
      }
    }

    if (onProgress) onProgress(`构建数据库 (${entries.length} 条)...`, 70);

    const dbPath = path.join(destDir, CCCEDICT_DB);

    // 优先使用 sqlite3 命令行工具（更可靠，无需 wasm）
    if (hasSqlite3Cli()) {
      createCccedictDbWithCli(entries, dbPath);
    } else {
      // 回退到 sql.js（需要正确配置 wasm 路径）
      const initSqlJs = require('sql.js');
      const wasmPath = path.join(path.dirname(require.resolve('sql.js')), 'sql-wasm.wasm');
      const wasmBinary = fs.readFileSync(wasmPath);
      const SQL = await initSqlJs({
        wasmBinary: wasmBinary
      });

      const db = new SQL.Database();

      // 创建表
      db.run(`
        CREATE TABLE cccedict (
          simplified TEXT,
          traditional TEXT,
          pinyin TEXT,
          english TEXT
        )
      `);

      // 创建索引
      db.run('CREATE INDEX idx_cccedict_s ON cccedict(simplified)');
      db.run('CREATE INDEX idx_cccedict_t ON cccedict(traditional)');

      db.run('BEGIN TRANSACTION');

      // 插入数据
      const stmt = db.prepare('INSERT INTO cccedict (simplified, traditional, pinyin, english) VALUES (?, ?, ?, ?)');

      for (const entry of entries) {
        stmt.run([entry.simplified, entry.traditional, entry.pinyin, entry.english]);
      }

      stmt.free();

      db.run('COMMIT');

      if (onProgress) onProgress('保存数据库...', 90);

      // 导出并保存
      const data = db.export();
      fs.writeFileSync(dbPath, Buffer.from(data));

      db.close();
    }

    // 清理临时文件
    files.forEach(f => {
      if (fs.existsSync(f.path)) {
        fs.unlinkSync(f.path);
      }
    });

    // 删除 zip 文件
    fs.unlinkSync(zipPath);

    if (onProgress) onProgress('完成', 100);

    return {
      success: true,
      dbPath
    };
  } catch (err) {
    return {
      success: false,
      dbPath: '',
      error: err
    };
  }
}

/**
 * 构建所有词典
 * @param {Object} options 选项
 * @param {string} options.repoPath 资源目录路径
 * @param {Function} options.onProgress 进度回调 (message, percent, phase)
 * @returns {Promise<{success: boolean, results: Array, error?: Error}>}
 */
async function buildAllDicts(options) {
  const { repoPath, onProgress } = options;

  if (!repoPath) {
    return {
      success: false,
      results: [],
      error: new Error('repoPath is required')
    };
  }

  const results = [];

  // 构建 ECDICT
  const ecdictZipPath = path.join(repoPath, ECDICT_ZIP);
  if (fs.existsSync(ecdictZipPath)) {
    const result = await buildEcdict(
      ecdictZipPath,
      repoPath,
      (msg, pct) => onProgress && onProgress(msg, pct, 'ecdict')
    );
    results.push({ dict: 'ecdict', ...result });

    if (!result.success) {
      return {
        success: false,
        results,
        error: result.error
      };
    }
  }

  // 构建 CC-CEDICT
  const cccedictZipPath = path.join(repoPath, CCCEDICT_ZIP);
  if (fs.existsSync(cccedictZipPath)) {
    const result = await buildCccedict(
      cccedictZipPath,
      repoPath,
      (msg, pct) => onProgress && onProgress(msg, pct, 'cccedict')
    );
    results.push({ dict: 'cccedict', ...result });

    if (!result.success) {
      return {
        success: false,
        results,
        error: result.error
      };
    }
  }

  return {
    success: true,
    results
  };
}

module.exports = {
  buildEcdict,
  buildCccedict,
  buildAllDicts,
  mergeVolumes,
  ECDICT_ZIP,
  CCCEDICT_ZIP,
  ECDICT_DB,
  CCCEDICT_DB
};
