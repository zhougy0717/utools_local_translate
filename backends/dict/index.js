/**
 * DICT 查词后端：使用 JavaScript 从 SQLite（ecdict.db / cccedict.db）查词。
 * 对外提供 queryWord(word, sourceLang, targetLang, callback)，返回 { found, translation?, phonetic?, message? }。
 */
const path = require('path');
const fs = require('fs');

function createDictBackend(options) {
  const dbPath = options && options.dictRepoPath
    ? path.join(options.dictRepoPath, 'ecdict.db')
    : (options && options.dbPath != null ? options.dbPath : path.join(__dirname, '..', '..', 'resources', 'ecdict.db'));
  const cccedictDbPath = options && options.dictRepoPath
    ? path.join(options.dictRepoPath, 'cccedict.db')
    : (options && options.cccedictDbPath != null ? options.cccedictDbPath : path.join(__dirname, '..', '..', 'resources', 'cccedict.db'));


  function queryWithSqlJs(word, callback) {
    try {
      const initSqlJs = require('sql.js');
      initSqlJs().then(function (SQL) {
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
      initSqlJs().then(function (SQL) {
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
   * @param {function(string)} [onProgress]
   */
  function queryWord(word, sourceLang, targetLang, callback, onProgress) {
    if (typeof sourceLang === 'function') {
      onProgress = targetLang;
      callback = sourceLang;
      sourceLang = 'en';
      targetLang = 'zh';
    } else if (typeof targetLang === 'function') {
      onProgress = callback;
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
        const cZipPath = options && options.dictRepoPath
          ? path.join(options.dictRepoPath, 'cedict_1_0_ts_utf-8_mdbg.zip')
          : path.join(__dirname, '..', '..', 'resources', 'cedict_1_0_ts_utf-8_mdbg.zip');
        if (fs.existsSync(cZipPath)) {
          if (onProgress) onProgress('正在触发 cccedict 离线词典构建...');
          const { buildCccedict } = require('./cccedictBuilder');
          const targetDir = path.dirname(cccedictDbPath);
          buildCccedict(cZipPath, targetDir, onProgress || (() => { })).then(() => {
            executeCccedictQuery();
          }).catch(err => {
            callback(null, { found: false, message: '词典自动转换失败: ' + err.message });
          });
        } else {
          callback(null, { found: false, message: '词库未就绪：缺少 cccedict 中英词典资源，请按文档自行下载' });
        }
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
      const eZipPath = options && options.dictRepoPath
        ? path.join(options.dictRepoPath, 'ecdict-sqlite-28.zip')
        : path.join(__dirname, '..', '..', 'resources', 'ecdict-sqlite-28.zip');
      if (fs.existsSync(eZipPath)) {
        if (onProgress) onProgress('正在触发 ecdict 离线词典构建...');
        const { build } = require('./builder');
        const targetDir = path.dirname(dbPath);
        build(eZipPath, targetDir, onProgress || (() => { })).then(() => {
          executeEcdictQuery();
        }).catch(err => {
          callback(null, { found: false, message: '词典自动转换失败: ' + err.message });
        });
      } else {
        callback(null, { found: false, message: '词库未就绪：缺少 ecdict 英中词典资源，请按文档自行下载' });
      }
      return;
    }
    executeEcdictQuery();
  }

  return { queryWord };
}

module.exports = { createDictBackend };
