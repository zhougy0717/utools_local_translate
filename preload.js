/**
 * 阶段零 Demo：在 uTools 中验证 preload 能访问并查询 resources/ecdict.db
 * 使用列表模式，enter 时显示欢迎词；search 时根据输入查词并展示。
 * 支持：用户先 Ctrl+C 复制选中文字，再打开插件时自动读取剪贴板并查词。
 */
const { createDictBackend } = require('./backends/dict/index.js');
const { createHelsinkiBackend } = require('./backends/helsinki/helsinki.js');
const CommandManager = require('./commands/index.js');

let lastWordToSearch = '';

// 默认配置
let appConfig = {
  resourcePath: '',
  backends: {
    offline_dict: true,
    helsinki_model: false
  }
};

// 从 uTools 数据库中读取配置
if (typeof utools !== 'undefined') {
  const storedConfig = utools.dbStorage.getItem('app_config');
  if (storedConfig) {
    appConfig = storedConfig;
  }
}

// 后续用于持久化配置：控制是否展示查询时延列表项
const GLOBAL_CONFIG = {
  showTranslationCost: true
};

// 后端初始化逻辑（简单优先级：Helsinki > ECDict）
// 这里如果是多选框都选了，目前优先级给大模型
let backend;
if (appConfig.backends.helsinki_model) {
  backend = createHelsinkiBackend({ modelRepoPath: appConfig.resourcePath });
} else {
  backend = createDictBackend({ dictRepoPath: appConfig.resourcePath });
}

if (typeof window !== 'undefined') {
  if (backend && typeof backend.stopWorker === 'function') {
    window.stopLocalWorker = backend.stopWorker.bind(backend);
  }
}

const MAX_SELECTION_LENGTH = 200;

/** 检测文本是否包含中文（CJK 统一汉字），用于决定英→中或中→英 */
function isLikelyChinese(text) {
  if (!text || !String(text).trim()) return false;
  return /[\u4e00-\u9fff]/.test(String(text).trim());
}

/**
 * @param {string} searchWord - 用户输入的查询词
 * @param {{ found: boolean, translation?: string, phonetic?: string, message?: string }} result - 后端返回
 * @param {boolean} [isZhToEn] - 是否为中→英结果（用于多释义拆条、拼音小字显示）
 */
function buildListItems(searchWord, result, isZhToEn, costTime) {
  let list = [];

  if (result.message) {
    list.push({ title: '词库未就绪', description: result.message });
  } else if (!result.found || !result.translation) {
    list.push({ title: '未找到释义', description: searchWord });
  } else {
    // 中→英：拼音放 description（小字），同一中文的多个英文释义拆成多条列表项
    if (isZhToEn) {
      const pinyinPart = result.phonetic ? result.phonetic + ' · ' : '';
      const desc = pinyinPart + searchWord;
      const parts = result.translation.split(/\s*;\s*/).map(function (s) { return s.trim(); }).filter(Boolean);

      if (parts.length === 0) {
        list.push({ title: '（无释义）', description: searchWord });
      } else {
        parts.forEach(function (en) {
          list.push({ title: en, description: desc });
        });
      }
    } else {
      // 英→中：title 为音标+释义，description 为被查词
      const translationText = [result.phonetic, result.translation].filter(Boolean).join(' ') || '（无释义）';
      list.push({ title: translationText, description: searchWord });
    }
  }

  // 独立追加时延统计项 (根据配置开关决定是否显示)去除了原本拼接到原本字符串中的功能
  if (costTime && GLOBAL_CONFIG.showTranslationCost) {
    const costSeconds = (costTime / 1000).toFixed(2);
    const modeDesc = appConfig.backends.helsinki_model ? '模型查询时延' : '词典查询时延';
    list.push({
      title: '⚡ 本地翻译耗时: ' + costSeconds + '秒',
      description: modeDesc,
      icon: ''
    });
  }

  return list;
}

/** 使用 uTools 官方 API 读取剪贴板文本（与 getCopyedFiles 同系列） */
function readClipboardText() {
  if (typeof utools === 'undefined') return '';
  if (typeof utools.getCopyedText === 'function') return utools.getCopyedText() || '';
  return '';
}

function applyEnterWithWord(word, callbackSetList) {
  const w = word.trim();
  if (!w || w.length > MAX_SELECTION_LENGTH) return false;
  if (typeof utools !== 'undefined') utools.setSubInputValue(w);
  const sourceLang = isLikelyChinese(w) ? 'zh' : 'en';
  const targetLang = sourceLang === 'zh' ? 'en' : 'zh';
  const isZhToEn = sourceLang === 'zh' && targetLang === 'en';

  const loadingDesc = appConfig.backends.helsinki_model ? '调用本地大模型，可能需要数秒钟，请稍候...' : '正在检索本地词典，请稍候...';
  callbackSetList([
    { title: '⏳ 正在检索中...', description: loadingDesc }
  ]);

  // 给 UI 进程 50ms 时间用于优先在查询前渲染上面的“请稍候”列表项，规避 WASM 强占 JS 线程引起的假死和白屏
  setTimeout(() => {
    const startTime = Date.now();
    backend.queryWord(w, sourceLang, targetLang, function (err, result) {
      const costMs = Date.now() - startTime;
      callbackSetList(buildListItems(w, result || { found: false }, isZhToEn, costMs));
    }, function (progressMsg) {
      callbackSetList([{ title: '词典自动构建中...', description: progressMsg }]);
    });
  }, 50);

  return true;
}

let searchTimeout = null;
const DEBOUNCE_DELAY = 600;

if (typeof window !== 'undefined') {
  window.exports = {
    dict: {
      mode: 'list',
      args: {
        placeholder: '输入单词或中文查词',
        enter: function (action, callbackSetList) {
          const configContainer = document.getElementById('config-container');
          if (configContainer) {
            configContainer.style.display = 'none';
          }
          // 从超级面板等入口带入的选中文字：type 为 over，payload 为选中文本
          const payloadText =
            action && action.type === 'over' && typeof action.payload === 'string'
              ? action.payload.trim()
              : '';
          if (payloadText && applyEnterWithWord(payloadText, callbackSetList)) return;

          // 通过关键字进入：直接读取剪贴板（用户需先自行 Ctrl+C 复制选中文字），有内容则自动查词
          const text = readClipboardText();
          if (text && applyEnterWithWord(text, callbackSetList)) return;
          callbackSetList([
            { title: '欢迎使用本地词典', description: '先复制要查的词 (Ctrl+C)，再打开本插件即可自动查词；或在上方输入框输入单词' }
          ]);
        },
        search: function (action, searchWord, callbackSetList) {
          if (searchTimeout) {
            clearTimeout(searchTimeout);
            searchTimeout = null;
          }

          if (!searchWord || !searchWord.trim()) {
            callbackSetList([]);
            return;
          }
          const w = searchWord.trim();

          if (w.startsWith('/')) {
            CommandManager.handleSearch(w, callbackSetList, appConfig);
            return;
          }

          lastWordToSearch = w;

          searchTimeout = setTimeout(() => {
            const loadingDesc = appConfig.backends.helsinki_model ? '调用本地大模型，可能需要数秒钟，请稍候...' : '正在检索本地词典，请稍候...';
            callbackSetList([
              { title: '⏳ 正在检索中...', description: loadingDesc }
            ]);

            const sourceLang = isLikelyChinese(w) ? 'zh' : 'en';
            const targetLang = sourceLang === 'zh' ? 'en' : 'zh';
            const isZhToEn = sourceLang === 'zh' && targetLang === 'en';

            // 给 UI 进程 50ms 时间用于优先在查询前渲染上面的“请稍候”列表项，规避 WASM 强占 JS 线程引起的假死和白屏
            setTimeout(() => {
              const startTime = Date.now();
              backend.queryWord(w, sourceLang, targetLang, function (err, result) {
                const costMs = Date.now() - startTime;
                callbackSetList(buildListItems(w, result || { found: false }, isZhToEn, costMs));
              }, function (progressMsg) {
                callbackSetList([{ title: '词典自动构建中...', description: progressMsg }]);
              });
            }, 50);
          }, DEBOUNCE_DELAY);
        },
        select: function (action, itemData, callbackSetList) {
          // 如果用户点击的是耗时统计条目，不进行任何动作
          if (itemData.title && itemData.title.startsWith('⚡ 本地翻译耗时')) {
            return;
          }

          if (itemData.isCommandContext) {
            const signal = CommandManager.handleSelect(itemData, appConfig, callbackSetList);
            if (signal.autoComplete) {
              if (typeof utools !== 'undefined') {
                utools.setSubInputValue(signal.autoComplete);
              }
            } else {
              if (signal.reloadBackend) {
                if (typeof window !== 'undefined' && window.stopLocalWorker) {
                  window.stopLocalWorker();
                  window.stopLocalWorker = null;
                }
                if (appConfig.backends.helsinki_model) {
                  backend = createHelsinkiBackend({ modelRepoPath: appConfig.resourcePath });
                } else {
                  backend = createDictBackend({ dictRepoPath: appConfig.resourcePath });
                }
                if (typeof window !== 'undefined' && backend && typeof backend.stopWorker === 'function') {
                  window.stopLocalWorker = backend.stopWorker.bind(backend);
                }
              }
              if (signal.restoreSearch) {
                if (typeof utools !== 'undefined') {
                  utools.setSubInputValue(lastWordToSearch || '');
                }
              }
            }
            return;
          }

          let textToCopy = itemData.title;
          if (itemData.title === '词库未就绪' || itemData.title === '未找到释义' || itemData.title === '欢迎使用本地词典') {
            textToCopy = itemData.description;
          }
          if (typeof utools !== 'undefined') {
            utools.copyText(textToCopy);
            utools.hideMainWindow();
            utools.showNotification('已复制内容');
          }
        }
      }
    },
    settings: {
      mode: 'none',
      args: {
        enter: (action) => {
          if (typeof utools !== 'undefined') {
            utools.showMainWindow();
            utools.setExpendHeight(600);
          }

          // 确保不重复添加
          let configContainer = document.getElementById('config-container');
          if (!configContainer) {
            configContainer = document.createElement('div');
            configContainer.id = 'config-container';
            configContainer.style.position = 'absolute';
            // 覆盖整个 body
            configContainer.style.position = 'fixed';
            configContainer.style.top = '0';
            configContainer.style.left = '0';
            configContainer.style.width = '100vw';
            configContainer.style.height = '100vh';
            configContainer.style.zIndex = '999999';
            configContainer.style.backgroundColor = '#fff';

            const iframe = document.createElement('iframe');
            const path = require('path');
            let normalizedPath = path.join(__dirname, 'config', 'index.html').replace(/\\/g, '/');
            if (!normalizedPath.startsWith('/')) {
              normalizedPath = '/' + normalizedPath;
            }
            iframe.src = 'file://' + normalizedPath;
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.style.border = 'none';
            iframe.style.display = 'block';
            configContainer.appendChild(iframe);
            document.body.appendChild(configContainer);
          }
          configContainer.style.display = 'block';
        }
      }
    }
  };
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports.isLikelyChinese = isLikelyChinese;
}
