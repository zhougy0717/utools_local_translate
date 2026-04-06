/**
 * uTools 翻译插件 Preload 核心入口
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
  backends: initialConfig.backends
};

BackendManager.init(backendConfig);
coreService.init(); // 初始化核心业务服务并注入 _proxyAPI 到 window

if (typeof window !== 'undefined') {
  window.stopLocalWorker = BackendManager.stop.bind(BackendManager);
}

const MAX_SELECTION_LENGTH = 5000;
const SEARCH_DEBOUNCE_MS = 300;      // 搜索防抖延迟，避免由于快速键入导致的频繁后端负载
const UI_LIST_CLEAR_DELAY = 100;     // 强制列表清空后的 UI 响应间隔，确保渲染器能够捕捉到列表被重置的状态
const UI_LOADING_RENDER_DELAY = 300;  // 渲染 Loading 提示后的预留延迟。关键在于给 UI 线程足够的时间在后端耗时查询（如 Ollama）开始前成功绘制“搜索中”提示。

function applyEnterWithWord(word, callbackSetList) {
  const w = word.trim();
  if (!w || w.length > MAX_SELECTION_LENGTH) return false;
  if (typeof utools !== 'undefined') utools.setSubInputValue(w);
  const sourceLang = UtoolsHelper.isLikelyChinese(w) ? 'zh' : 'en';
  const targetLang = sourceLang === 'zh' ? 'en' : 'zh';
  const isZhToEn = sourceLang === 'zh' && targetLang === 'en';

  callbackSetList(ViewPresenter.buildLoadingItem(BackendManager.getLoadingMessage()));

  // 给 UI 进程 100ms 时间用于优先在查询前渲染上面的"请稍候"列表项
  setTimeout(() => {
    const startTime = Date.now();
    BackendManager.queryWord(w, sourceLang, targetLang, function (err, result) {
      const costMs = Date.now() - startTime;
      callbackSetList(ViewPresenter.buildResultItems(w, result || { found: false }, isZhToEn, costMs, BackendManager.getBackendName(), appConfig.shouldShowTranslationCost()));
    }, function (progressMsg) {
      callbackSetList(ViewPresenter.buildProgressItem(progressMsg));
    });
  }, 100);

  return true;
}

let searchTimeout = null;

if (typeof window !== 'undefined') {
  window.exports = {
    dict: {
      mode: 'list',
      args: {
        placeholder: '输入单词或中文查词',
        enter: function (action, callbackSetList) {
          // 统一清理：确保关闭任何可能遗留的配置面板（实现零感知解耦）
          BackendManager.closeCurrentConfigPanel();

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
            // 提高清除界面的优先级
            BackendManager.closeCurrentConfigPanel(true);

            console.log('[Preload] Initiating first-render sequence...');

            // 步骤 1: 强制清空当前列表，打破 UI 引擎的批量合并
            callbackSetList([]);

            // 步骤 2: 在 UI 线程确认清空后再渲染加载项，确保变更能被平滑捕捉
            setTimeout(() => {
              const loadingMsg = BackendManager.getLoadingMessage();
              console.log('[Preload] Rendering Loading Item:', loadingMsg);
              callbackSetList(ViewPresenter.buildLoadingItem(loadingMsg));

              const sourceLang = UtoolsHelper.isLikelyChinese(w) ? 'zh' : 'en';
              const targetLang = sourceLang === 'zh' ? 'en' : 'zh';
              const isZhToEn = sourceLang === 'zh' && targetLang === 'en';

              // 步骤 3: 渲染 Loading 后的保障期。设置 300ms 延迟可有效防止后续可能产生的
              // 同步阻塞任务（如大语言模型首包生成前的计算）直接抢占 UI 渲染帧，从而确保“搜索中”状态可见。
              setTimeout(() => {
                const startTime = Date.now();
                console.log('[Preload] Dispatching query to backend...');
                BackendManager.queryWord(w, sourceLang, targetLang, function (err, result) {
                  const costMs = Date.now() - startTime;
                  console.log('[Preload] Result received from backend');
                  callbackSetList(ViewPresenter.buildResultItems(w, result || { found: false }, isZhToEn, costMs, BackendManager.getBackendName(), appConfig.shouldShowTranslationCost()));
                }, function (progressMsg) {
                  callbackSetList(ViewPresenter.buildProgressItem(progressMsg));
                });
              }, UI_LOADING_RENDER_DELAY);
            }, UI_LIST_CLEAR_DELAY);
          }, SEARCH_DEBOUNCE_MS);
        },
        select: function (action, itemData, callbackSetList) {
          console.log('[Preload] Select item:', itemData);

          // 如果用户点击的是进阶翻译项
          if (itemData.isAdvancedOllama) {
            console.log('[Preload] Entering advanced translation center');
            BackendManager.openAdvancedPanel(itemData.searchWord, itemData.targetLangCode, itemData.initialResult, itemData.backendName);
            return;
          }

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


                if (signal.openConfigPanel) {
                  console.log('[Preload] Opening config panel via BackendManager');
                  if (signal.reloadBackend) {
                    appConfig.clearCache();
                    const newConfig = appConfig.load();
                    const backendConfig = {
                      resourcePath: newConfig.resourcePath || '',
                      proxy: appConfig.getProxy(),
                      backends: newConfig.backends
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
                        backends: newConfig.backends
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
                    const updatedAppConfig = appConfig.load();
                    const backendConfig = {
                      resourcePath: updatedAppConfig.resourcePath || '',
                      proxy: appConfig.getProxy(),
                      backends: updatedAppConfig.backends,
                      ollama: updatedAppConfig.ollama,
                      libretranslate: updatedAppConfig.libretranslate
                    };
                    BackendManager.reload(backendConfig);
                    console.log('[Preload][Mode] Backend reloaded for:', BackendManager.getBackendName());
                  }

                  if (signal.restoreSearch) {
                    const wordToRestore = lastWordToSearch || '';
                    console.log('[Preload] Mode switch complete, restoring search word:', wordToRestore);
                    if (wordToRestore) {
                      // 仅仅设置输入框内容，并交给 uTools 的 search 回调处理，避免双重触发
                      requestAnimationFrame(() => {
                        utools.setSubInputValue(wordToRestore);
                      });
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
