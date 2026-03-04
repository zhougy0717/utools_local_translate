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
      if (!fs.existsSync(cccedictDbPath)) {
        callback(null, { found: false, message: '词库未就绪：请确保 cccedict.db 存在' });
        return;
      }
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
      try {
        require('sql.js');
        queryCccedictWithSqlJs(w, onCccedictResult);
      } catch (e) {
        callback(null, { found: false, message: e.message || String(e) });
      }
      return;
    }

    if (!fs.existsSync(dbPath)) {
      callback(null, { found: false, message: '词库未就绪：请确保 ecdict.db 存在' });
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
    try {
      require('sql.js');
      queryWithSqlJs(w, onResult);
    } catch (e) {
      queryWithCli(w, onResult);
    }
  }

  return { queryWord };
}

module.exports = { createDictBackend };
