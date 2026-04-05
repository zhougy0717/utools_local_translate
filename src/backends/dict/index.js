/**
 * DICT 查词后端：使用 JavaScript 从 SQLite（ecdict.db / cccedict.db）查词。
 * 对外提供 queryWord(word, sourceLang, targetLang, callback)，返回 { found, translation?, phonetic?, message? }。
 */
const path = require('path');
const fs = require('fs');
const { DictConfig } = require('./config');
const { DictDownloader } = require('./downloader');
const { 
  buildAllDicts, 
  mergeVolumes, 
  buildEcdict, 
  buildCccedict,
  ECDICT_ZIP,
  CCCEDICT_ZIP,
  ECDICT_DB,
  CCCEDICT_DB
} = require('./builder');

// 词典状态枚举
const DICT_STATUS = {
  READY: 'READY',                        // 已就绪：词典数据库文件存在且可用
  UNAVAILABLE: 'UNAVAILABLE',            // 未下载：词典文件完全不存在
  DOWNLOADING: 'DOWNLOADING',            // 下载中：正在进行下载操作
  DOWNLOAD_FAILED: 'DOWNLOAD_FAILED',   // 下载失败：下载过程中发生错误
  DOWNLOADED_UNPROCESSED: 'DOWNLOADED_UNPROCESSED'  // 已下载未处理：压缩包已下载但尚未解压转换
};

// 下载文件名称由 builder.js 导出提供

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

  const dlResult = await downloader.downloadAll(onProgress);
  if (!dlResult.success) return dlResult;

  // 补充原本缺失的构建步骤：解压并转换
  if (onProgress) onProgress('正在解压与构建所有词典...', 90);
  const buildResult = await buildAllDicts({
    repoPath: destDir,
    onProgress: (msg, pct, phase) => {
      if (onProgress) onProgress(msg, pct, phase);
    }
  });

  return buildResult;
}

/**
 * 从 Gitee 下载并构建词典 (spec-00024)
 * ecdict 从 Gitee 分卷下载，cccedict 依然从原路径下载
 * @param {Object} options 选项
 * @param {string} options.destDir 目标目录
 * @param {string} [options.proxy] 代理
 * @param {Function} options.onProgress 进度回调
 * @returns {Promise<Object>} 
 */
async function downloadDictsFromGitee(options) {
  const { destDir, proxy, onProgress } = options;
  if (!destDir) return { success: false, error: new Error('destDir is required') };

  const downloader = new DictDownloader({ destDir, proxy });

  // 1. 处理 ECDICT
  const dbPath = path.join(destDir, 'ecdict.db');
  if (!fs.existsSync(dbPath)) {
    const zipPath = path.join(destDir, ECDICT_ZIP);
    const mergedZipPath = path.join(destDir, 'ecdict_merged.zip');

    if (!fs.existsSync(zipPath) && !fs.existsSync(mergedZipPath)) {
      // 1.1 下载分卷
      if (onProgress) onProgress({ dict: 'ecdict', percent: 0, downloaded: 0, total: 0 }, 'downloading');
      const dlResult = await downloader.downloadVolumes(null, (percent, downloaded, total) => {
        if (onProgress) onProgress({ dict: 'ecdict', percent, downloaded, total }, 'downloading');
      });

      if (!dlResult.success) return dlResult;

      // 1.2 合并分卷
      if (onProgress) onProgress('正在合并分卷...', 90, 'ecdict');
      try {
        await mergeVolumes(dlResult.paths, mergedZipPath);
      } catch (err) {
        return { success: false, error: new Error(`合并分卷失败: ${err.message}`) };
      }

      // 清理分卷
      dlResult.paths.forEach(p => {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      });
    }

    const targetZipPath = fs.existsSync(mergedZipPath) ? mergedZipPath : zipPath;

    // 1.3 构建 (解压并重命名)
    if (onProgress) onProgress('正在解压与构建...', 95, 'ecdict');
    const buildResult = await buildEcdict(targetZipPath, destDir, (msg, pct) => {
      if (onProgress) onProgress(msg, pct, 'ecdict');
    });

    if (targetZipPath === mergedZipPath && fs.existsSync(mergedZipPath)) {
      fs.unlinkSync(mergedZipPath);
    }

    if (!buildResult.success) return buildResult;
  } else {
    if (onProgress) onProgress({ percent: 100, downloaded: 1, total: 1 }, 'ecdict');
  }

  // 2. 处理 CC-CEDICT
  const cccedictDbPath = path.join(destDir, 'cccedict.db');
  if (!fs.existsSync(cccedictDbPath)) {
    const zipPath = path.join(destDir, CCCEDICT_ZIP);

    if (!fs.existsSync(zipPath)) {
      if (onProgress) onProgress({ dict: 'cccedict', percent: 0, downloaded: 0, total: 0 }, 'downloading');
      const dlResult = await downloader.downloadCccedict((percent, downloaded, total) => {
        if (onProgress) onProgress({ dict: 'cccedict', percent, downloaded, total }, 'downloading');
      });

      if (!dlResult.success) return dlResult;
    }

    if (onProgress) onProgress('正在解压与构建...', 95, 'cccedict');
    const buildResult = await buildCccedict(path.join(destDir, CCCEDICT_ZIP), destDir, (msg, pct) => {
      if (onProgress) onProgress(msg, pct, 'cccedict');
    });

    if (!buildResult.success) return buildResult;
  } else {
    if (onProgress) onProgress({ percent: 100, downloaded: 1, total: 1 }, 'cccedict');
  }

  return { success: true };
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
  const closePanelFn = function(isSilent = false) {
    const container = document.getElementById('dict-config-container');
    if (container) {
      container.remove();
      if (!isSilent) {
        if (typeof utools !== 'undefined') utools.setExpendHeight(0);
      }
    }
    
    delete window._dictAPI;
    delete window.hideDictConfig;

    if (typeof this._onPanelClose === 'function') {
      const callback = this._onPanelClose;
      this._onPanelClose = null;
      if (!isSilent) callback();
    }
  };

  const openConfigPanelFn = function(onCloseCallback) {
    if (typeof document === 'undefined') return;
    this._onPanelClose = onCloseCallback;
    if (typeof utools !== 'undefined') utools.setExpendHeight(600);

    const { appConfig } = require('../../utils/app_config');

    window._dictAPI = {
      chooseDirectory() {
        if (typeof utools === 'undefined') return null;
        const result = utools.showOpenDialog({
          title: '选择词典数据存储目录',
          properties: ['openDirectory']
        });
        return (result && result.length > 0) ? result[0] : null;
      },
      getDefaultDirectory() {
        const cfg = sharedConfigManager.load();
        const appCfg = appConfig.load();
        return cfg.dictRepoPath || appCfg.resourcePath || '';
      },
      async startDownload(options, onProgress) {
        sharedConfigManager.save({ dictRepoPath: options.destDir });
        
        try {
          const appCfg = appConfig.load();
          appCfg.resourcePath = options.destDir;
          if (typeof utools !== 'undefined') {
              utools.dbStorage.setItem('app_config', appCfg);
          }
          const proxy = appConfig.getProxy();

          const downloadOptions = {
            destDir: options.destDir,
            proxy: proxy,
            onProgress(progress, phase) {
              if (typeof progress === 'string') {
                  onProgress({ phase: 'building', dict: phase === 'ecdict' ? 'ecdict' : 'cccedict', percent: 90, downloaded: 0, total: 0, message: progress });
              } else {
                  onProgress({
                    phase: 'downloading',
                    dict: progress.dict || phase,
                    percent: progress.percent || 0,
                    downloaded: progress.downloaded || 0,
                    total: progress.total || 0,
                    message: ''
                  });
              }
            }
          };

          const result = options.source === 'gitee' 
             ? await downloadDictsFromGitee(downloadOptions)
             : await downloadDicts(downloadOptions);

          return result;
        } catch (err) {
          return { success: false, error: err };
        }
      },
      closePanel: () => closePanelFn.call(this),
      openProxyConfig() {
        const { coreService } = require('../../core/core_service');
        const proxyService = coreService.getProxyService();
        if (proxyService && typeof proxyService.openPanel === 'function') {
            proxyService.openPanel();
        } else {
            console.error('[DictBackend] ProxyService.openPanel not available');
        }
      }
    };

    window.hideDictConfig = window._dictAPI.closePanel;

    let iframeContainer = document.getElementById('dict-config-container');
    if (!iframeContainer) {
        iframeContainer = document.createElement('div');
        iframeContainer.id = 'dict-config-container';
        iframeContainer.style.position = 'fixed';
        iframeContainer.style.top = '0';
        iframeContainer.style.left = '0';
        iframeContainer.style.width = '100vw';
        iframeContainer.style.height = '100vh';
        iframeContainer.style.zIndex = '999999';
        iframeContainer.style.backgroundColor = '#f6f8fa';
        
        const iframe = document.createElement('iframe');
        const htmlPath = path.resolve(__dirname, 'dict-config.html');
        let normalizedPath = htmlPath.replace(/\\/g, '/');
        if (!normalizedPath.startsWith('/')) normalizedPath = '/' + normalizedPath;
        const finalUrl = 'file://' + normalizedPath;
        
        iframe.src = finalUrl;
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        iframe.style.display = 'block';
        iframeContainer.appendChild(iframe);
        document.body.appendChild(iframeContainer);
    }
    iframeContainer.style.display = 'block';
  };

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
      },
      openConfigPanel: openConfigPanelFn,
      closePanel: closePanelFn
    };
  }

  const dbPath = path.join(config.dictRepoPath, ECDICT_DB);
  const cccedictDbPath = path.join(config.dictRepoPath, CCCEDICT_DB);

  let sqlPromise = null;

  /**
   * 内部 SQL.js 初始化助手 (实现单例缓存)
   */
  async function _getSqlJs() {
    if (sqlPromise) return sqlPromise;
    sqlPromise = (async () => {
      const initSqlJs = require('sql.js');
      const wasmPath = path.join(path.dirname(require.resolve('sql.js')), 'sql-wasm.wasm');
      const wasmBinary = fs.readFileSync(wasmPath);
      return await initSqlJs({ wasmBinary });
    })();
    return sqlPromise;
  }

  async function queryWithSqlJs(word, callback) {
    try {
      const SQL = await _getSqlJs();
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
    } catch (e) {
      callback(e);
    }
  }

  async function queryCccedictWithSqlJs(word, callback) {
    try {
      const SQL = await _getSqlJs();
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
      queryWithSqlJs(w, onResult);
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
    },
    openConfigPanel: openConfigPanelFn,
    closePanel: closePanelFn
  };
}

// 导出独立函数
module.exports = {
  createDictBackend,
  getDictStatus,
  DICT_STATUS
};
