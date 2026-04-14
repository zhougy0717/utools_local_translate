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

// 初始化后端（静默启动）
BackendManager.reloadFromAppConfig(true);
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
  
  const targetOverride = appConfig.getTranslationTarget();
  const { source, target, isZhToEn } = UtoolsHelper.detectLanguages(w, targetOverride);

  callbackSetList(ViewPresenter.buildLoadingItem(BackendManager.getLoadingMessage()));

  // 给 UI 进程 100ms 时间用于优先在查询前渲染上面的"请稍候"列表项
  setTimeout(() => {
    const startTime = Date.now();
    BackendManager.queryWord(w, source, target, function (err, result) {
      const costMs = Date.now() - startTime;
      callbackSetList(ViewPresenter.buildResultItems(w, result || { found: false }, isZhToEn, costMs, BackendManager.getBackendName(), appConfig.shouldShowTranslationCost()));
    }, function (progressMsg) {
      callbackSetList(ViewPresenter.buildProgressItem(progressMsg));
    });
  }, 100);

  return true;
}

/**
 * 客户端预处理：等比缩放并中度压缩图片，解决高清截图 Base64 负载过大问题
 * @param {string} dataUrl - 原始 Base64
 * @returns {Promise<string>} 压缩后的 Base64
 */
function _preprocessImage(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 1024; // 限制长边为 1024px
      let width = img.width;
      let height = img.height;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      // 转换为 JPEG 并设置 0.8 质量压缩
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => resolve(dataUrl); // 降级处理
    img.src = dataUrl;
  });
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

          // 处理图片输入 (来自 uTools 的搜索建议或截图)
          if (action && action.type === 'img' && action.payload) {
            console.log('[Preload] Image translation triggered');
            callbackSetList(ViewPresenter.buildLoadingItem('正在预处理并识别图中文字...'));
            
            // 使用用户配置或默认逻辑确定目标语言
            const targetOverride = appConfig.getTranslationTarget();
            const { target } = UtoolsHelper.detectLanguages('', targetOverride);

            _preprocessImage(action.payload).then(processedPayload => {
                const startTime = Date.now();
                BackendManager.queryImage(processedPayload, target, (err, result) => {
                    const costMs = Date.now() - startTime;
                    if (err) {
                        callbackSetList(ViewPresenter.buildResultItems('图片翻译失败', { found: false, translation: '识别过程出错: ' + err.message }, false, costMs, BackendManager.getBackendName(), appConfig.shouldShowTranslationCost()));
                        return;
                    }
                    // [VITAL FIX] 必须传递 processedPayload，否则后续进阶中心无法通过 ocrImage 获取图源
                    callbackSetList(ViewPresenter.buildResultItems('图片翻译', result || { found: false }, false, costMs, BackendManager.getBackendName(), appConfig.shouldShowTranslationCost(), processedPayload));
                }, (progressMsg) => {
                    callbackSetList(ViewPresenter.buildProgressItem(progressMsg));
                });
            });
            return;
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
          // TODO: 这里的清理逻辑需要严格受控。
          // 之前发现：如果在输入指令（如 /mo）的过程中频繁调用 closeCurrentConfigPanel(true)，
          // 会因为 DOM 的频繁变动/移除操作干扰 uTools 列表引擎的渲染帧，导致命令列表项无法正常显示。
          // 目前通过 !startsWith('/') 和 hasActivePanel() 进行了按需清理，确保了指令导航的稳定性。
          if (!searchWord.startsWith('/') && BackendManager.hasActivePanel()) {
            BackendManager.closeCurrentConfigPanel(true);
          }

          if (searchTimeout) {
            clearTimeout(searchTimeout);
            searchTimeout = null;
          }

          if (!searchWord || !searchWord.trim()) {
            // 粘性模式支持：即便输入为空，如果处于指令模式中，也要交给指令中心处理（显示全量列表+返回项）
            if (CommandManager.hasContext()) {
              CommandManager.handleSearch('', callbackSetList, appConfig);
              return;
            }
            callbackSetList([]);
            return;
          }
          const w = searchWord.trim();

          if (w.startsWith('/') || CommandManager.hasContext()) {
            CommandManager.handleSearch(w, callbackSetList, appConfig);
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
              const targetOverride = appConfig.getTranslationTarget();
              
              // 步骤 3: 渲染 Loading 后的保障期
              setTimeout(() => {
                const startTime = Date.now();
                console.log('[Preload] Dispatching query to backend...');
                BackendManager.queryWord(w, targetOverride, function (err, result) {
                  const costMs = Date.now() - startTime;
                  console.log('[Preload] Result received from backend');
                  
                  // 重新启用语种显示建议
                  const isZh = UtoolsHelper.isLikelyChinese(w);
                  callbackSetList(ViewPresenter.buildResultItems(w, result || { found: false }, isZh, costMs, BackendManager.getBackendName(), appConfig.shouldShowTranslationCost()));
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
            // 如果存在提取出的原文 ocrText，则透传它，否则使用 searchWord (指令名)
            const source = itemData.ocrText || itemData.searchWord;
            // 自动判断页签：有图就进 ocr，没图就进 advanced
            const task = itemData.ocrImage ? 'ocr' : 'advanced';
            BackendManager.openAdvancedPanel(source, itemData.targetLangCode, itemData.initialResult, itemData.backendName, itemData.ocrImage, task);
            return;
          }

          // 如果用户点击的是耗时统计条目，不进行任何动作
          if (itemData.title && itemData.title.startsWith('⚡ 本地翻译耗时')) {
            console.log('[Preload] Ignored cost item click');
            return;
          }

          if (itemData.isCommandContext) {
            Promise.resolve(CommandManager.handleSelect(itemData, appConfig, callbackSetList))
              .then(signal => {
                if (!signal) return;

                // 打开配置面板
                if (signal.openConfigPanel) {
                  if (signal.reloadBackend) BackendManager.reloadFromAppConfig();
                  
                  BackendManager.openConfigPanel(() => {
                    BackendManager.reloadFromAppConfig();
                    if (typeof utools !== 'undefined') {
                      setTimeout(() => { utools.setSubInputValue(''); }, 10);
                    }
                  });
                  return;
                }

                // 自动补全
                if (signal.autoComplete) {
                  if (typeof utools !== 'undefined') utools.setSubInputValue(signal.autoComplete);
                  return;
                }

                // 仅重载后端并恢复搜索
                if (signal.reloadBackend) {
                  BackendManager.reloadFromAppConfig();
                  console.log('[Preload][Mode] Backend reloaded for:', BackendManager.getBackendName());
                }

                // 核心修复：如果需要恢复搜索
                if (signal.restoreSearch) {
                  // 如果有历史词，恢复它；如果没有（比如刚进插件），则清空输入框以触发重置
                  const wordToSet = lastWordToSearch || '';
                  console.log('[Preload] Restore search signal received, setting input to:', wordToSet);
                  
                  // 强制清除 context（双重保障）并重置 UI
                  CommandManager.clearContext();
                  
                  requestAnimationFrame(() => {
                    utools.setSubInputValue(wordToSet);
                  });
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
