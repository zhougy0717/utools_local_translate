/**
 * 阶段零 Demo：在 uTools 中验证 preload 能访问并查询 resources/ecdict.db
 * 使用列表模式，enter 时显示欢迎词；search 时根据输入查词并展示。
 * 支持：用户先 Ctrl+C 复制选中文字，再打开插件时自动读取剪贴板并查词。
 */
const BackendManager = require('./src/core/backend_manager');
const ViewPresenter = require('./src/utils/view_presenter');
const UtoolsHelper = require('./src/utils/utools_helper');
const CommandManager = require('./src/commands/index.js');
const { appConfig } = require('./src/utils/app_config');
const { DictConfig } = require('./src/backends/dict/config');
const { coreService } = require('./src/core/core_service');

let lastWordToSearch = '';

// 初始化配置
const initialConfig = appConfig.load();

// 构建 BackendManager 需要的配置格式
const backendConfig = {
  resourcePath: initialConfig.resourcePath || '',
  proxy: appConfig.getProxy(),
  backends: initialConfig.backends,
  // 为兼容旧版 BackendManager，传递各 backend 配置
  ollama: {},
  libretranslate: {}
};

BackendManager.init(backendConfig);
coreService.init(); // 初始化核心业务服务并注入 _proxyAPI 到 window

  window.openProxyConfigPanel = function(onCloseCallback) {
    const path = require('path');
    if (typeof utools !== 'undefined') utools.setExpendHeight(600);


    // 此时 window._proxyAPI 已经由 coreService.init() 注入，但我们仍需关联销毁回调
    const proxyService = coreService.getProxyService();
    
    window._closeProxyConfigPanel = function() {
        const container = document.getElementById('proxy-config-container');
        if (container) container.remove();
        
        if (typeof utools !== 'undefined') utools.setExpendHeight(0);
        window.focus();
        if (typeof onCloseCallback === 'function') onCloseCallback();
    };

    window.hideProxyConfig = proxyService.closePanel.bind(proxyService);

    let iframeContainer = document.getElementById('proxy-config-container');
    if (!iframeContainer) {
        iframeContainer = document.createElement('div');
        iframeContainer.id = 'proxy-config-container';
        iframeContainer.style.position = 'fixed';
        iframeContainer.style.top = '0';
        iframeContainer.style.left = '0';
        iframeContainer.style.width = '100vw';
        iframeContainer.style.height = '100vh';
        iframeContainer.style.zIndex = '999999';
        iframeContainer.style.backgroundColor = '#f8fafc';
        
        const iframe = document.createElement('iframe');
        const htmlPath = path.resolve(__dirname, 'src/config/proxy-config.html');
        let normalizedPath = htmlPath.replace(/\\/g, '/');
        if (!normalizedPath.startsWith('/')) normalizedPath = '/' + normalizedPath;
        iframe.src = 'file://' + normalizedPath;
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        iframe.style.display = 'block';
        iframeContainer.appendChild(iframe);
        document.body.appendChild(iframeContainer);
    }
    iframeContainer.style.display = 'block';
  };

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

  // 给 UI 进程 50ms 时间用于优先在查询前渲染上面的"请稍候"列表项，规避 WASM 强占 JS 线程引起的假死和白屏
  setTimeout(() => {
    const startTime = Date.now();
    BackendManager.queryWord(w, sourceLang, targetLang, function (err, result) {
      const costMs = Date.now() - startTime;
      callbackSetList(ViewPresenter.buildResultItems(w, result || { found: false }, isZhToEn, costMs, BackendManager.getBackendName(), appConfig.shouldShowTranslationCost()));
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
          if (typeof window.hideProxyConfig === 'function') {
            window.hideProxyConfig();
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
          if (typeof window.hideProxyConfig === 'function') {
            window.hideProxyConfig();
          }

          if (!searchWord || !searchWord.trim()) {
            callbackSetList([]);
            return;
          }
          const w = searchWord.trim();

          if (w.startsWith('/')) {
            CommandManager.handleSearch(w, callbackSetList, appConfig.load());
            return;
          }

          lastWordToSearch = w;

          searchTimeout = setTimeout(() => {
            callbackSetList(ViewPresenter.buildLoadingItem(BackendManager.getLoadingMessage()));

            const sourceLang = UtoolsHelper.isLikelyChinese(w) ? 'zh' : 'en';
            const targetLang = sourceLang === 'zh' ? 'en' : 'zh';
            const isZhToEn = sourceLang === 'zh' && targetLang === 'en';

            // 给 UI 进程 50ms 时间用于优先在查询前渲染上面的"请稍候"列表项，规避 WASM 强占 JS 线程引起的假死和白屏
            setTimeout(() => {
              const startTime = Date.now();
              BackendManager.queryWord(w, sourceLang, targetLang, function (err, result) {
                const costMs = Date.now() - startTime;
                callbackSetList(ViewPresenter.buildResultItems(w, result || { found: false }, isZhToEn, costMs, BackendManager.getBackendName(), appConfig.shouldShowTranslationCost()));
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
            Promise.resolve(CommandManager.handleSelect(itemData, appConfig.load(), callbackSetList))
              .then(signal => {
              console.log('[Preload] Command signal:', signal);
              if (!signal) return;
              console.log('[Preload] Command signal resolved:', signal);

              if (signal.openProxyConfigPanel) {
                console.log('[Preload] Opening proxy config panel');
                window.openProxyConfigPanel(() => {
                    console.log('[Preload] Proxy config panel closed, reloading...');
                    appConfig.clearCache();
                    const newConfig = appConfig.load();
                    const backendConfig = {
                        resourcePath: newConfig.resourcePath || '',
                        proxy: appConfig.getProxy(),
                        backends: newConfig.backends,
                        ollama: {},
                        libretranslate: {}
                    };
                    BackendManager.reload(backendConfig);
                });
                return;
              }

              if (signal.openConfigPanel) {
                console.log('[Preload] Opening config panel via BackendManager');
                if (signal.reloadBackend) {
                    appConfig.clearCache();
                    const newConfig = appConfig.load();
                    const backendConfig = {
                        resourcePath: newConfig.resourcePath || '',
                        proxy: appConfig.getProxy(),
                        backends: newConfig.backends,
                        ollama: {},
                        libretranslate: {}
                    };
                    BackendManager.reload(backendConfig);
                }

                BackendManager.openConfigPanel(() => {
                    console.log('[Preload] Config panel closed, reloading...');
                    try {
                        appConfig.clearCache();
                        const newConfig = appConfig.load();
                        const backendConfig = {
                          resourcePath: newConfig.resourcePath || '',
                          proxy: appConfig.getProxy(),
                          backends: newConfig.backends,
                          ollama: {},
                          libretranslate: {}
                        };
                        BackendManager.reload(backendConfig);

                        if (typeof utools !== 'undefined') {
                            setTimeout(() => {
                              utools.setSubInputValue('');
                            }, 10);
                        }
                    } catch (e) {
                        console.error('[Preload] Error in config callback:', e);
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
                  appConfig.clearCache();
                  const newConfig = appConfig.load();
                  const backendConfig = {
                    resourcePath: newConfig.resourcePath || '',
                    proxy: appConfig.getProxy(),
                    backends: newConfig.backends,
                    ollama: {},
                    libretranslate: {}
                  };
                  BackendManager.reload(backendConfig);
                }
                if (signal.restoreSearch) {
                  const wordToRestore = lastWordToSearch || '';
                  // 如果有之前查询的单词且不是命令，自动触发翻译
                  if (wordToRestore && !wordToRestore.startsWith('/')) {
                    if (typeof utools !== 'undefined') {
                      utools.setSubInputValue(wordToRestore);
                    }
                    applyEnterWithWord(wordToRestore, callbackSetList);
                  } else if (typeof utools !== 'undefined') {
                    utools.setSubInputValue(wordToRestore);
                  }
                }
              }
            })
            .catch(err => {
              console.error('[Preload] Command handleSelect error:', err);
            });
            return;
          }

          let textToCopy = itemData.copyText || itemData.title;
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
