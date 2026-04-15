/**
 * 进阶翻译面板渲染器 (Advanced Renderer)
 * 通过 window.parent._advancedAPI 与核心业务逻辑通信
 */

const Bridge = window.parent._advancedAPI;
let currentTask = 'advanced';

const UI = {
  btnExecute: document.getElementById('btn-execute'),
  btnConfig: document.getElementById('btn-config'),
  sourceInput: document.getElementById('source-input'),
  promptInput: document.getElementById('prompt-input'),
  resultText: document.getElementById('result-text'),
  langSelect: document.getElementById('lang-select'),
  langSelectGroup: document.getElementById('lang-select-group'),
  modelSelect: document.getElementById('model-select'),
  modelSelectLabel: document.getElementById('model-select-label'),
  connectionStatus: document.getElementById('connection-status'),
  tokenUsage: document.getElementById('token-usage'),
  // 核心新增：侧边栏与多风格结果视图容器
  sidebar: document.getElementById('sidebar'),
  resultLabel: document.getElementById('result-label'),
  namingResults: document.getElementById('naming-results'),
  namingSuggestions: document.getElementById('naming-suggestions'),
  // 命名输入框引用
  namingInputs: {
    pascal: document.getElementById('naming-pascal'),
    camel: document.getElementById('naming-camel'),
    snake: document.getElementById('naming-snake'),
    constant: document.getElementById('naming-constant'),
    kebab: document.getElementById('naming-kebab')
  },
  ocrPreviewPane: document.getElementById('ocr-preview-pane'),
  ocrPreviewImg: document.getElementById('ocr-preview-img'),
  ocrEmptyHint: document.getElementById('ocr-empty-hint'),
  promptPane: document.getElementById('prompt-pane')
};

/**
 * 任务切换逻辑
 */
function switchTask(task) {
  if (currentTask === task) return;
  currentTask = task;
  
  // 更新导航项激活状态
  const items = UI.sidebar.querySelectorAll('.nav-item');
  items.forEach(item => {
    if (item.dataset.task === task) item.classList.add('active');
    else item.classList.remove('active');
  });

  // 根据任务类型切换 UI 显隐
  if (task === 'naming') {
    UI.resultLabel.textContent = '变量命名';
    UI.resultText.style.display = 'none';
    UI.namingResults.style.display = 'flex';
    // 切换任务时重置命名结果
    Object.values(UI.namingInputs).forEach(input => { input.value = ''; });
    // 命名时目标语言默认英文且隐藏语言选择器
    UI.langSelect.value = 'en';
    UI.langSelectGroup.style.display = 'none';
    UI.ocrPreviewPane.style.display = 'none';
    UI.promptPane.style.display = 'flex';
    UI.btnExecute.textContent = '生成变量命名';
  } else if (task === 'ocr') {
    UI.resultLabel.textContent = '图片翻译结果';
    UI.resultText.style.display = 'block';
    UI.namingResults.style.display = 'none';
    UI.langSelectGroup.style.display = 'flex';
    UI.ocrPreviewPane.style.display = 'flex';
    UI.promptPane.style.display = 'none';
    UI.btnExecute.textContent = '识图翻译';
    UI.sourceInput.placeholder = 'AI 识别出的原文将在此处呈现，您可以进行微调以精修译文...';
    
    // 动态更新模型选择逻辑
    UI.modelSelectLabel.textContent = '识图模型:';
    const config = Bridge.loadConfig();
    UI.modelSelect.value = config.visionModel || config.model; // 优先使用 visionModel
    
    refreshOcrPreview();
  } else {
    UI.resultLabel.textContent = '翻译结果';
    UI.resultText.style.display = 'block';
    UI.namingResults.style.display = 'none';
    UI.langSelectGroup.style.display = 'flex';
    UI.ocrPreviewPane.style.display = 'none';
    UI.promptPane.style.display = 'flex';
    UI.btnExecute.textContent = '立即翻译';
    
    // 恢复为文本模型选择
    UI.modelSelectLabel.textContent = '使用模型:';
    const config = Bridge.loadConfig();
    UI.modelSelect.value = config.model;
  }

  // 立即根据当前原文更新提示词
  refreshPrompt();
}

/**
 * 更新提示词 (使用占位符模板)
 */
function refreshPrompt() {
  UI.promptInput.value = Bridge.getInitialPrompt(UI.langSelect.value, currentTask);
}

/**
 * 更新状态栏
 */
function updateStatus(isOnline, message = '', token = 0) {
  const dot = isOnline ? '<span class="status-online">●</span>' : '<span class="status-offline">●</span>';
  const statusMsg = isOnline ? (message || 'Ollama 已就绪') : (message || '未连接');
  UI.connectionStatus.innerHTML = `${dot} ${statusMsg}`;
  UI.tokenUsage.textContent = `Token: ${token} | 状态: ${isOnline ? '就绪' : '不可用'}`;
}

/**
 * 填充模型选择
 */
function populateModels(models, selectedModel = '') {
  UI.modelSelect.innerHTML = '';
  if (!models || models.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '未发现可用模型';
    UI.modelSelect.appendChild(opt);
    return;
  }

  models.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = m;
    if (m === selectedModel) opt.selected = true;
    UI.modelSelect.appendChild(opt);
  });
}

/**
 * 渲染命名结果 (处理多建议词标签)
 */
function renderNamingResults(rawText) {
  // 按照约定使用 | 分隔建议词
  const suggestions = rawText.split('|')
    .map(s => s.trim())
    .filter(s => s && s.length > 0)
    .slice(0, 5); // 最多取 5 个

  UI.namingSuggestions.innerHTML = '';
  
  if (suggestions.length > 0) {
    UI.namingSuggestions.style.display = 'flex';
    suggestions.forEach((phrase, index) => {
      const tag = document.createElement('div');
      tag.className = 'suggestion-tag';
      if (index === 0) tag.classList.add('active');
      tag.textContent = phrase;
      
      tag.onclick = () => {
        // 切换激活状态
        UI.namingSuggestions.querySelectorAll('.suggestion-tag').forEach(t => t.classList.remove('active'));
        tag.classList.add('active');
        // 刷新下方各风格结果
        applyStyles(phrase);
      };
      
      UI.namingSuggestions.appendChild(tag);
    });
    
    // 默认执行第一个建议词的格式化
    applyStyles(suggestions[0]);
  } else {
    UI.namingSuggestions.style.display = 'none';
    applyStyles(rawText);
  }
}

/**
 * 将短语应用到各种命名风格
 */
function applyStyles(phrase) {
  const styles = Bridge.formatNaming(phrase);
  UI.namingInputs.pascal.value = styles.pascal || '';
  UI.namingInputs.camel.value = styles.camel || '';
  UI.namingInputs.snake.value = styles.snake || '';
  UI.namingInputs.constant.value = styles.constant || '';
  UI.namingInputs.kebab.value = styles.kebab || '';
}

/**
 * 执行翻译/命名
 */
async function handleTask() {
  const text = UI.sourceInput.value.trim();
  const prompt = UI.promptInput.value.trim();
  const model = UI.modelSelect.value;
  const targetLang = UI.langSelect.options[UI.langSelect.selectedIndex].text;

  if (!text || !prompt) return;

  UI.btnExecute.disabled = true;
  const originalBtnText = UI.btnExecute.textContent;

  // 图片翻译模式处理
  if (currentTask === 'ocr') {
    // 逻辑：如果识别出的原文由用户手动修改过，则降级为普通翻译不再执行耗时的 OCR
    if (UI.sourceInput.value.trim() && isSourceEditedManually) {
       UI.btnExecute.textContent = '正在翻译修正文本...';
    } else {
       UI.btnExecute.textContent = '正在识图中 (Vision)...';
       const imageData = UI.ocrPreviewImg.src;
       if (!imageData || imageData.length < 100) {
         UI.resultText.textContent = '⚠️ 请先截取或粘贴图片。';
         UI.btnExecute.disabled = false;
         UI.btnExecute.textContent = originalBtnText;
         return;
       }

       // 先预检预校验视觉能力
       const check = await Bridge.checkVision();
       if (!check.supported) {
         UI.resultText.textContent = `❌ ${check.message}`;
         UI.btnExecute.disabled = false;
         UI.btnExecute.textContent = originalBtnText;
         return;
       }

       try {
         const ocrResult = await Bridge.ocrTranslate({
            imageData,
            targetLangCode: UI.langSelect.value
         });
         if (ocrResult.success) {
            UI.sourceInput.value = ocrResult.ocrText;
            UI.resultText.textContent = ocrResult.translation;
            updateStatus(true, '图片识别并翻译成功');
            isSourceEditedManually = false; // 重置编辑标志
         } else {
            UI.resultText.textContent = `❌ 识别失败: ${ocrResult.error}`;
         }
       } catch (e) {
          UI.resultText.textContent = `❌ 插件内部错误: ${e.message}`;
       } finally {
          UI.btnExecute.disabled = false;
          UI.btnExecute.textContent = originalBtnText;
       }
       return;
    }
  }

  UI.btnExecute.textContent = currentTask === 'naming' ? '命名中...' : '翻译中...';
  
  if (currentTask !== 'naming') {
    UI.resultText.textContent = 'AI 正在思考中...';
  } else {
    // 命名模式下，清空现有结果和建议词
    UI.namingSuggestions.innerHTML = '';
    UI.namingSuggestions.style.display = 'none';
    Object.values(UI.namingInputs).forEach(input => { input.value = ''; });
  }

  // 核心修复：在这里动态合并原文到提示词
  let finalPrompt = prompt;
  if (finalPrompt.includes('[TEXT]')) {
    // 使用全局替换，防止用户多次使用占位符
    finalPrompt = finalPrompt.replace(/\[TEXT\]/g, text);
  } else {
    // 如果用户不慎删除了占位符，但在原文区输入了内容，则静默追加以确保翻译生效
    finalPrompt = `${finalPrompt}\n\n[附带原文内容]:\n${text}`;
  }

  try {
    const result = await Bridge.translate({
      text,
      prompt: finalPrompt,
      model,
      targetLang
    });

    if (result.success) {
      if (currentTask === 'naming') {
        renderNamingResults(result.translation);
      } else {
        UI.resultText.textContent = result.translation;
      }
      updateStatus(true, currentTask === 'naming' ? '命名生成成功' : '翻译完成', result.usage || 0);
    } else {
      const errorMsg = `❌ 发生错误: ${result.error}`;
      if (currentTask === 'naming') {
        UI.namingInputs.pascal.value = errorMsg;
      } else {
        UI.resultText.textContent = errorMsg;
      }
      updateStatus(true, '请求失败');
    }
  } catch (e) {
    const errorMsg = `❌ 网络或接口异常: ${e.message}`;
    if (currentTask === 'naming') UI.namingInputs.pascal.value = errorMsg;
    else UI.resultText.textContent = errorMsg;
    updateStatus(false, '连接异常');
  } finally {
    UI.btnExecute.disabled = false;
    UI.btnExecute.textContent = originalBtnText;
  }
}

/**
 * 初始化
 */
async function init() {
  if (!Bridge) {
    UI.resultText.textContent = '错误：Bridge API 未发现。请从 uTools 内部启动进阶翻译中心。';
    return;
  }

  const config = Bridge.loadConfig();

  // 初始化模型列表 (根据初次进入的任务类型决定选中哪个模型)
  const initialTaskModel = (config.initialTask === 'ocr') ? (config.visionModel || config.model) : config.model;
  populateModels(config.models || [], initialTaskModel);
  
  // 初始化内容
  UI.sourceInput.value = config.initialText || '';
  
  // [NEW] 如果是图片翻译任务且输入的是指令名 "图片翻译"，则清空原文框以免干扰识别
  if (currentTask === 'ocr' && UI.sourceInput.value === '图片翻译') {
    UI.sourceInput.value = '';
  }
  
  // 设置初始语言
  if (config.initialTargetLang) {
    UI.langSelect.value = config.initialTargetLang;
  }
  
  // [NEW] 切换至指定的初始任务页签 (默认为普通翻译)
  // 注意：这里先 populateModels 后 switchTask 是安全的，因为 switchTask 内部也会根据最新 config 再次校正模型选中值
  if (config.initialTask) {
    switchTask(config.initialTask);
  } else {
    switchTask('advanced');
  }
  
  // 初始化提示词
  refreshPrompt();

  // 如果已有初始翻译结果，则直接显示
  if (config.initialResult) {
    UI.resultText.textContent = config.initialResult;
    const sourceMsg = config.initialBackendName ? `结果来自: ${config.initialBackendName}` : '已有翻译结果';
    updateStatus(true, sourceMsg);
  } else {
    UI.resultText.textContent = '等待翻译...';
  }

  // 按钮事件
  UI.btnExecute.addEventListener('click', handleTask);
  UI.btnConfig.addEventListener('click', () => Bridge.openOllamaConfig());

  // 侧边栏任务切换事件
  UI.sidebar.addEventListener('click', (e) => {
    const item = e.target.closest('.nav-item');
    if (item && item.dataset.task) {
      switchTask(item.dataset.task);
    }
  });

  // 绑定预设的复制按钮事件
  ['pascal', 'camel', 'snake', 'constant', 'kebab'].forEach(key => {
    const btn = document.getElementById(`copy-${key}`);
    if (btn) {
      btn.onclick = () => {
        const val = UI.namingInputs[key].value;
        if (val) Bridge.copyText(val);
      };
    }
  });

  // 语言切换时自动更新提示词
  UI.langSelect.addEventListener('change', () => {
    refreshPrompt();
  });

  // 实况状态检查
  const check = await Bridge.checkStatus();
  // 仅在没有已有结果的情况下更新状态栏信息，避免冲掉后端来源显示
  if (!config.initialResult) {
    updateStatus(check.online, check.message);
  }

  // [NEW] 监听模型选择变化并保存
  UI.modelSelect.addEventListener('change', () => {
    const selectedModel = UI.modelSelect.value;
    const configToUpdate = {};
    if (currentTask === 'ocr') {
        configToUpdate.visionModel = selectedModel;
    } else {
        configToUpdate.model = selectedModel;
    }
    
    Bridge.saveConfig(configToUpdate);
    console.log(`[Advanced] Saved ${currentTask === 'ocr' ? 'visionModel' : 'model'}: ${selectedModel}`);
  });

  // [NEW] 核心策略：如果是从其他后端（如 离线词典/LibreTranslate）跳转过来的，
  // 为了让用户即刻感知到 Ollama 的深度翻译/润色能力，在进入页面时自动发起查询
  const isNonOllamaSource = config.initialBackendName && !config.initialBackendName.toLowerCase().includes('ollama');
  const hasSourceText = UI.sourceInput.value.trim().length > 0;
  
  if (isNonOllamaSource && hasSourceText && currentTask === 'advanced') {
      console.log('[Advanced] Non-Ollama source detected, triggering auto-translate...');
      handleTask();
  }
}

// 记录原文是否被手动编辑过，用于 OCR 模式下的降级逻辑
let isSourceEditedManually = false;
UI.sourceInput.addEventListener('input', () => {
    isSourceEditedManually = true;
});

/**
 * 刷新 OCR 预览区
 */
function refreshOcrPreview() {
    // 为确保显示逻辑稳如磐石：合并处理透传图片与剪贴板读取，直接赋能给 src
    const config = Bridge.loadConfig();
    const imgSource = config.initialImage || (Bridge.readImage ? Bridge.readImage() : null);

    if (imgSource && imgSource.length > 200) { // 合法 Base64 线长通常很大
        console.log('[Renderer] Image detected, updating src...');
        UI.ocrPreviewImg.src = imgSource;
        UI.ocrPreviewImg.style.display = 'block';
        UI.ocrEmptyHint.style.display = 'none';

        // 特殊：如果是通过透传进来且没有文字内容，自动触发 OCR
        if (!UI.sourceInput.value.trim() && !isSourceEditedManually) {
            handleTask();
        }
    } else {
        console.warn('[Renderer] No image data available.');
        UI.ocrPreviewImg.style.display = 'none';
        UI.ocrEmptyHint.style.display = 'block';
        UI.ocrEmptyHint.textContent = '检测到剪贴板中暂无有效图片。请尝试 Ctrl+V 粘贴内容。';
    }
}

// 监听粘贴事件，支持在 OCR 模式或任何模式下直接通过粘贴图片切换至图片翻译
window.addEventListener('paste', async (e) => {
    const items = e.clipboardData.items;
    for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
            const file = item.getAsFile();
            const reader = new FileReader();
            reader.onload = (event) => {
                const base64 = event.target.result;
                // 自动切换至 OCR 任务并预览展示
                if (currentTask !== 'ocr') switchTask('ocr');
                UI.ocrPreviewImg.src = base64;
                UI.ocrPreviewImg.style.display = 'block';
                UI.ocrEmptyHint.style.display = 'none';
                UI.sourceInput.value = '';
                isSourceEditedManually = false;
                handleTask();
            };
            reader.readAsDataURL(file);
            break;
        }
    }
});

init();
