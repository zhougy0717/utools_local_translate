/**
 * 阶段零 Demo：在 uTools 中验证 preload 能访问并查询 resources/ecdict.db
 * 使用列表模式，enter 时显示欢迎词；search 时根据输入查词并展示。
 * 支持：用户先 Ctrl+C 复制选中文字，再打开插件时自动读取剪贴板并查词。
 */
const BackendManager = require('./src/core/backend_manager');
const ViewPresenter = require('./src/utils/view_presenter');
const UtoolsHelper = require('./src/utils/utools_helper');
const CommandManager = require('./commands/index.js');

let lastWordToSearch = '';

// 默认配置
let appConfig = {
  resourcePath: '',
  proxy: '',
  backends: {
    offline_dict: true,
    ollama: false
  },
  ollama: {
    apiBase: 'http://127.0.0.1:11434/v1',
    model: '',
    prompt: '你是一个专业的翻译助手。请将以下文本翻译为${target_lang}。只输出翻译结果，不要输出任何解释说明。'
  }
};

// 后续用于持久化配置：控制是否展示查询时延列表项
const GLOBAL_CONFIG = {
  showTranslationCost: true
};

// 从 uTools 数据库中读取配置并初始化 Backend
if (typeof utools !== 'undefined') {
  const storedConfig = utools.dbStorage.getItem('app_config');
  if (storedConfig) {
    const oldBackends = JSON.parse(JSON.stringify(appConfig.backends));
    appConfig = Object.assign({}, appConfig, storedConfig);
    // 确保 backends 是合并而非覆盖
    appConfig.backends = Object.assign({}, oldBackends, storedConfig.backends || {});
    
    if (!appConfig.ollama) {
        appConfig.ollama = {
            apiBase: 'http://127.0.0.1:11434/v1',
            model: '',
            prompt: '你是一个专业的翻译助手。请将以下文本翻译为${target_lang}。只输出翻译结果，不要输出任何解释说明。'
        };
    }
  }
}
BackendManager.init(appConfig);

if (typeof window !== 'undefined') {
  window.stopLocalWorker = BackendManager.stop.bind(BackendManager);
}

const MAX_SELECTION_LENGTH = 200;

function applyEnterWithWord(word, callbackSetList) {
  const w = word.trim();
  if (!w || w.length > MAX_SELECTION_LENGTH) return false;
  if (typeof utools !== 'undefined') utools.setSubInputValue(w);
  const sourceLang = UtoolsHelper.isLikelyChinese(w) ? 'zh' : 'en';
  const targetLang = sourceLang === 'zh' ? 'en' : 'zh';
  const isZhToEn = sourceLang === 'zh' && targetLang === 'en';

  callbackSetList(ViewPresenter.buildLoadingItem(BackendManager.getLoadingMessage()));

  // 给 UI 进程 50ms 时间用于优先在查询前渲染上面的“请稍候”列表项，规避 WASM 强占 JS 线程引起的假死和白屏
  setTimeout(() => {
    const startTime = Date.now();
    BackendManager.queryWord(w, sourceLang, targetLang, function (err, result) {
      const costMs = Date.now() - startTime;
      callbackSetList(ViewPresenter.buildResultItems(w, result || { found: false }, isZhToEn, costMs, BackendManager.getBackendName(), GLOBAL_CONFIG.showTranslationCost));
    }, function (progressMsg) {
      callbackSetList(ViewPresenter.buildProgressItem(progressMsg));
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
          // 清除任何可能遗留的配置面板
          if (typeof window.hideOllamaConfig === 'function') {
            window.hideOllamaConfig();
          }
          
          // 从超级面板等入口带入的选中文字：type 为 over，payload 为选中文本
          const payloadText =
            action && action.type === 'over' && typeof action.payload === 'string'
              ? action.payload.trim()
              : '';
          if (payloadText && applyEnterWithWord(payloadText, callbackSetList)) return;

          // 通过关键字进入：直接读取剪贴板（用户需先自行 Ctrl+C 复制选中文字），有内容则自动查词
          const text = UtoolsHelper.readClipboardText();
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

          if (typeof window.hideOllamaConfig === 'function') {
            window.hideOllamaConfig();
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
            callbackSetList(ViewPresenter.buildLoadingItem(BackendManager.getLoadingMessage()));

            const sourceLang = UtoolsHelper.isLikelyChinese(w) ? 'zh' : 'en';
            const targetLang = sourceLang === 'zh' ? 'en' : 'zh';
            const isZhToEn = sourceLang === 'zh' && targetLang === 'en';

            // 给 UI 进程 50ms 时间用于优先在查询前渲染上面的“请稍候”列表项，规避 WASM 强占 JS 线程引起的假死和白屏
            setTimeout(() => {
              const startTime = Date.now();
              BackendManager.queryWord(w, sourceLang, targetLang, function (err, result) {
                const costMs = Date.now() - startTime;
                callbackSetList(ViewPresenter.buildResultItems(w, result || { found: false }, isZhToEn, costMs, BackendManager.getBackendName(), GLOBAL_CONFIG.showTranslationCost));
              }, function (progressMsg) {
                callbackSetList(ViewPresenter.buildProgressItem(progressMsg));
              });
            }, 50);
          }, DEBOUNCE_DELAY);
        },
        select: function (action, itemData, callbackSetList) {
          console.log('[Preload] Select item:', itemData);
          // 如果用户点击的是耗时统计条目，不进行任何动作
          if (itemData.title && itemData.title.startsWith('⚡ 本地翻译耗时')) {
            console.log('[Preload] Ignored cost item click');
            return;
          }

          if (itemData.isCommandContext) {
            const signal = CommandManager.handleSelect(itemData, appConfig, callbackSetList);
            console.log('[Preload] Command signal:', signal);

            if (signal.openOllamaConfigPanel) {
              console.log('[Preload] Opening Ollama config via BackendManager');
              BackendManager.openOllamaConfig(() => {
                  console.log('[Preload] Ollama config closed, reloading...');
                  try {
                      // 配置可能有修改，读取最新配置并重启 backend
                      if (typeof utools !== 'undefined') {
                        const storedConfig = utools.dbStorage.getItem('app_config');
                        if (storedConfig) {
                            // 深度合并 backends 避免丢失其他后端的开启状态
                            const oldBackends = JSON.parse(JSON.stringify(appConfig.backends));
                            appConfig = Object.assign({}, appConfig, storedConfig);
                            appConfig.backends = Object.assign({}, oldBackends, storedConfig.backends || {});
                            console.log('[Preload] Updated appConfig:', appConfig);
                        }
                      }
                      
                      BackendManager.reload(appConfig);
                      
                      if (typeof utools !== 'undefined') {
                          // 给 uTools 渲染管线留一个 tick，避免输入框清理后的 focus 抢占由于 iframe 移除引起的 DOM 变动卡顿
                          setTimeout(() => {
                            utools.setSubInputValue('');
                          }, 10);
                      }
                  } catch (e) {
                      console.error('[Preload] Error in Ollama config callback:', e);
                  }
              });
              return;
            }

            if (signal.autoComplete) {
              if (typeof utools !== 'undefined') {
                utools.setSubInputValue(signal.autoComplete);
              }
            } else {
              if (signal.reloadBackend) {
                BackendManager.reload(appConfig);
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
    }
  };
}
