/**
 * DICT 查词后端：使用 JavaScript 从 SQLite（ecdict.db / cccedict.db）查词。
 * 对外提供 queryWord(word, sourceLang, targetLang, callback)，返回 { found, translation?, phonetic?, message? }。
 */
const path = require('path');
const fs = require('fs');
const { DictConfig } = require('./config');
const { DictDownloader } = require('./downloader');
const { buildAllDicts, mergeVolumes, buildEcdict } = require('./builder');

// 词典状态枚举
const DICT_STATUS = {
  READY: 'READY',                        // 已就绪：词典数据库文件存在且可用
  UNAVAILABLE: 'UNAVAILABLE',            // 未下载：词典文件完全不存在
  DOWNLOADING: 'DOWNLOADING',            // 下载中：正在进行下载操作
  DOWNLOAD_FAILED: 'DOWNLOAD_FAILED',   // 下载失败：下载过程中发生错误
  DOWNLOADED_UNPROCESSED: 'DOWNLOADED_UNPROCESSED'  // 已下载未处理：压缩包已下载但尚未解压转换
};

// 下载文件名称
const ECDICT_ZIP = 'ecdict-sqlite-28.zip';
const CCCEDICT_ZIP = 'cedict_1_0_ts_utf-8_mdbg.zip';

// 共享配置管理器实例
let sharedConfigManager = null;

/**
 * 检测词典状态
 * @param {Object} appConfig 应用配置
 * @returns {Object} { status, path, details }
 */
function getDictStatus(appConfig) {
  appConfig = appConfig || {};
  const repoPath = appConfig.resourcePath || appConfig.dictRepoPath;

  if (!repoPath) {
    return { status: DICT_STATUS.UNAVAILABLE, path: '', details: { ecdict: false, cccedict: false } };
  }

  const ecdictDbPath = path.join(repoPath, 'ecdict.db');
  const cccedictDbPath = path.join(repoPath, 'cccedict.db');

  const ecdictExists = fs.existsSync(ecdictDbPath);
  const cccedictExists = fs.existsSync(cccedictDbPath);

  const details = {
    ecdict: ecdictExists,
    cccedict: cccedictExists
  };

  if (ecdictExists && cccedictExists) {
    return { status: DICT_STATUS.READY, path: repoPath, details };
  }

  // 检查是否有下载中的临时文件（.downloading 后缀）
  const ecdictTempPath = path.join(repoPath, ECDICT_ZIP + '.downloading');
  const cccedictTempPath = path.join(repoPath, CCCEDICT_ZIP + '.downloading');

  const ecdictTempExists = fs.existsSync(ecdictTempPath);
  const cccedictTempExists = fs.existsSync(cccedictTempPath);

  if (ecdictTempExists || cccedictTempExists) {
    // 有临时文件，表示下载中断，需要断点续传
    return { status: DICT_STATUS.DOWNLOADING, path: repoPath, details };
  }

  // 检查是否有下载的压缩包
  const ecdictZipPath = path.join(repoPath, ECDICT_ZIP);
  const cccedictZipPath = path.join(repoPath, CCCEDICT_ZIP);

  const ecdictZipExists = fs.existsSync(ecdictZipPath);
  const cccedictZipExists = fs.existsSync(cccedictZipPath);

  if (ecdictZipExists || cccedictZipExists) {
    return { status: DICT_STATUS.DOWNLOADED_UNPROCESSED, path: repoPath, details };
  }

  return { status: DICT_STATUS.UNAVAILABLE, path: repoPath, details };
}

/**
 * 下载词典（需要外部传入 proxy 配置）
 * @param {Object} options 下载选项
 * @param {string} options.destDir 目标目录
 * @param {string} [options.proxy] 代理服务器地址
 * @param {Function} options.onProgress 进度回调
 * @returns {Promise<Object>} 下载结果
 */
async function downloadDicts(options) {
  const { destDir, proxy, onProgress } = options;

  if (!destDir) {
    return { success: false, error: new Error('destDir is required') };
  }

  const downloader = new DictDownloader({
    destDir,
    proxy
  });

  const result = await downloader.downloadAll(onProgress);
  return result;
}

/**
 * 从 Gitee 下载并构建 ECDICT 词典 (spec-00024)
 * @param {Object} options 选项
 * @param {string} options.destDir 目标目录
 * @param {string} [options.proxy] 代理
 * @param {Function} options.onProgress 进度回调
 * @returns {Promise<Object>} 
 */
async function downloadEcdictFromGitee(options) {
  const { destDir, proxy, onProgress } = options;
  if (!destDir) return { success: false, error: new Error('destDir is required') };

  const downloader = new DictDownloader({ destDir, proxy });
  
  // 1. 下载分卷
  if (onProgress) onProgress({ dict: 'ecdict', percent: 0, downloaded: 0, total: 0 }, 'downloading');
  const dlResult = await downloader.downloadVolumes(null, (percent, downloaded, total) => {
    if (onProgress) onProgress({ dict: 'ecdict', percent, downloaded, total }, 'downloading');
  });

  if (!dlResult.success) return dlResult;

  // 2. 合并分卷
  if (onProgress) onProgress('正在合并分卷...', 90, 'ecdict');
  const mergedZipPath = path.join(destDir, 'ecdict_merged.zip');
  try {
    await mergeVolumes(dlResult.paths, mergedZipPath);
  } catch (err) {
    return { success: false, error: new Error(`合并分卷失败: ${err.message}`) };
  }

  // 3. 构建 (解压并重命名)
  if (onProgress) onProgress('正在解压与构建...', 95, 'ecdict');
  const buildResult = await buildEcdict(mergedZipPath, destDir, (msg, pct) => {
    if (onProgress) onProgress(msg, pct, 'ecdict');
  });

  // 4. 清理分卷
  dlResult.paths.forEach(p => {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  });
  if (fs.existsSync(mergedZipPath)) fs.unlinkSync(mergedZipPath);

  return buildResult;
}

function createDictBackend(options) {
  // 如果传入的是 DictConfig 实例，直接使用
  if (options instanceof DictConfig) {
    sharedConfigManager = options;
    options = options.load();
  } else if (!sharedConfigManager) {
    sharedConfigManager = new DictConfig();
  }

  // 合并配置
  const config = Object.assign({}, sharedConfigManager.load(), options || {});
  if (!config.dictRepoPath) {
    // 强制要求配置路径
    return {
      queryWord: function (word, sourceLang, targetLang, callback) {
        if (typeof sourceLang === 'function') callback = sourceLang;
        else if (typeof targetLang === 'function') callback = targetLang;
        callback(null, { found: false, message: '请配置词典绝对路径，不配置无法使用' });
      },
      getConfigManager: function() {
        return sharedConfigManager;
      }
    };
  }

  const dbPath = path.join(config.dictRepoPath, 'ecdict.db');
  const cccedictDbPath = path.join(config.dictRepoPath, 'cccedict.db');

  function queryWithSqlJs(word, callback) {
    try {
      const initSqlJs = require('sql.js');
      const wasmPath = path.join(path.dirname(require.resolve('sql.js')), 'sql-wasm.wasm');
      const wasmBinary = fs.readFileSync(wasmPath);
      initSqlJs({
        wasmBinary: wasmBinary
      }).then(function (SQL) {
        const fileBuffer = fs.readFileSync(dbPath);
        const db = new SQL.Database(fileBuffer);
        const safeWord = word.replace(/'/g, "''");
        const res = db.exec(
          "SELECT translation, phonetic FROM stardict WHERE word = '" + safeWord + "' COLLATE NOCASE LIMIT 1"
        );
        db.close();
        if (res.length && res[0].values.length) {
          const row = res[0].values[0];
          callback(null, { translation: row[0] || '', phonetic: row[1] || '' });
        } else {
          callback(null, null);
        }
      }).catch(function (err) {
        callback(err || new Error('sql.js 加载失败'));
      });
    } catch (e) {
      callback(e);
    }
  }

  function queryWithCli(word, callback) {
    const { execSync } = require('child_process');
    try {
      const safeWord = word.replace(/"/g, '""');
      const out = execSync(
        'sqlite3 "' + dbPath + '" "SELECT translation, phonetic FROM stardict WHERE word = \'' + word.replace(/'/g, "''") + '\' COLLATE NOCASE LIMIT 1;"',
        { encoding: 'utf-8', maxBuffer: 1024 * 1024 }
      );
      const line = out.trim().split('\n')[0];
      if (!line) {
        callback(null, null);
        return;
      }
      const parts = line.split('|');
      callback(null, { translation: parts[0] || '', phonetic: parts[1] || '' });
    } catch (e) {
      callback(e);
    }
  }

  function queryCccedictWithSqlJs(word, callback) {
    try {
      const initSqlJs = require('sql.js');
      const wasmPath = path.join(path.dirname(require.resolve('sql.js')), 'sql-wasm.wasm');
      const wasmBinary = fs.readFileSync(wasmPath);
      initSqlJs({
        wasmBinary: wasmBinary
      }).then(function (SQL) {
        const fileBuffer = fs.readFileSync(cccedictDbPath);
        const db = new SQL.Database(fileBuffer);
        const stmt = db.prepare('SELECT english, pinyin FROM cccedict WHERE simplified = ? OR traditional = ? LIMIT 1');
        stmt.bind([word, word]);
        let row = null;
        if (stmt.step()) {
          const obj = stmt.getAsObject();
          row = { translation: obj.english || '', phonetic: obj.pinyin || '' };
        }
        stmt.free();
        db.close();
        callback(null, row);
      }).catch(function (err) {
        callback(err || new Error('sql.js 加载失败'));
      });
    } catch (e) {
      callback(e);
    }
  }

  /**
   * @param {string} word
   * @param {string} sourceLang
   * @param {string} targetLang
   * @param {function(Error?, { found: boolean, translation?: string, phonetic?: string, message?: string }?)} callback
   */
  function queryWord(word, sourceLang, targetLang, callback) {
    if (typeof sourceLang === 'function') {
      callback = sourceLang;
      sourceLang = 'en';
      targetLang = 'zh';
    } else if (typeof targetLang === 'function') {
      callback = targetLang;
      targetLang = 'zh';
    } else if (typeof callback !== 'function') {
      callback = function () { };
    }
    if (!word || !word.trim()) {
      callback(null, { found: false });
      return;
    }
    const w = word.trim();
    const isZhToEn = sourceLang === 'zh' && targetLang === 'en';

    if (isZhToEn) {
      function onCccedictResult(err, row) {
        if (err) {
          callback(null, { found: false, message: err.message || String(err) });
          return;
        }
        if (!row || !row.translation) {
          callback(null, { found: false });
          return;
        }
        callback(null, {
          found: true,
          translation: row.translation,
          phonetic: row.phonetic
        });
      }

      function executeCccedictQuery() {
        try {
          require('sql.js');
          queryCccedictWithSqlJs(w, onCccedictResult);
        } catch (e) {
          callback(null, { found: false, message: e.message || String(e) });
        }
      }

      if (!fs.existsSync(cccedictDbPath)) {
        callback(null, { found: false, message: '请配置词典绝对路径，不配置无法使用。缺少 cccedict.db' });
        return;
      }
      executeCccedictQuery();
      return;
    }

    function onResult(err, row) {
      if (err) {
        callback(null, { found: false, message: err.message || String(err) });
        return;
      }
      if (!row || !row.translation) {
        callback(null, { found: false });
        return;
      }
      callback(null, {
        found: true,
        translation: row.translation,
        phonetic: row.phonetic
      });
    }

    function executeEcdictQuery() {
      try {
        require('sql.js');
        queryWithSqlJs(w, onResult);
      } catch (e) {
        queryWithCli(w, onResult);
      }
    }

    if (!fs.existsSync(dbPath)) {
      callback(null, { found: false, message: '请配置词典绝对路径，不配置无法使用。缺少 ecdict.db' });
      return;
    }
    executeEcdictQuery();
  }

  return {
    queryWord,
    getConfigManager: function() {
      return sharedConfigManager;
    }
  };
}

// 导出独立函数
module.exports = {
  createDictBackend,
  getDictStatus,
  downloadDicts,
  downloadEcdictFromGitee,
  buildAllDicts,
  DICT_STATUS
};
