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
  }
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
    UI.btnExecute.textContent = '执行命名';
  } else {
    UI.resultLabel.textContent = '翻译结果';
    UI.resultText.style.display = 'block';
    UI.namingResults.style.display = 'none';
    UI.langSelectGroup.style.display = 'inline';
    UI.btnExecute.textContent = '执行翻译';
  }

  // 立即根据当前原文更新提示词
  refreshPrompt();
}

/**
 * 更新提示词
 */
function refreshPrompt() {
  UI.promptInput.value = Bridge.getInitialPrompt(UI.sourceInput.value, UI.langSelect.value, currentTask);
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
function populateModels(models, currentModel = '') {
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
    if (m === currentModel) opt.selected = true;
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
  UI.btnExecute.textContent = currentTask === 'naming' ? '命名中...' : '翻译中...';
  
  if (currentTask !== 'naming') {
    UI.resultText.textContent = 'AI 正在思考中...';
  } else {
    // 命名模式下，清空现有结果和建议词
    UI.namingSuggestions.innerHTML = '';
    UI.namingSuggestions.style.display = 'none';
    Object.values(UI.namingInputs).forEach(input => { input.value = ''; });
  }

  try {
    const result = await Bridge.translate({
      text,
      prompt,
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
  UI.sourceInput.value = config.initialText || '';
  
  // 设置初始语言
  if (config.initialTargetLang) {
    UI.langSelect.value = config.initialTargetLang;
  }
  
  // 初始化模型列表
  populateModels(config.models || [], config.currentModel);
  
  // 初始化提示词
  refreshPrompt();

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
  updateStatus(check.online, check.message);
  
  // 自动触发首次执行 (如果初始内容不为空)
  if (UI.sourceInput.value.trim()) {
    handleTask();
  }
}

// 监听 Escape 键退出
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') Bridge.closePanel();
});

init();
