/**
 * 进阶翻译面板渲染器 (Advanced Renderer)
 * 通过 window.parent._advancedAPI 与核心业务逻辑通信
 */

const Bridge = window.parent._advancedAPI;

const UI = {
  btnExecute: document.getElementById('btn-execute'),
  btnConfig: document.getElementById('btn-config'),
  sourceInput: document.getElementById('source-input'),
  promptInput: document.getElementById('prompt-input'),
  resultText: document.getElementById('result-text'),
  langSelect: document.getElementById('lang-select'),
  modelSelect: document.getElementById('model-select'),
  connectionStatus: document.getElementById('connection-status'),
  tokenUsage: document.getElementById('token-usage')
};

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
 * 执行翻译
 */
async function handleTranslate() {
  const text = UI.sourceInput.value.trim();
  const prompt = UI.promptInput.value.trim();
  const model = UI.modelSelect.value;
  const targetLang = UI.langSelect.options[UI.langSelect.selectedIndex].text;

  if (!text || !prompt) return;

  UI.btnExecute.disabled = true;
  UI.btnExecute.textContent = '翻译中...';
  UI.resultText.textContent = 'AI 正在思考中...';

  try {
    const result = await Bridge.translate({
      text,
      prompt,
      model,
      targetLang
    });

    if (result.success) {
      UI.resultText.textContent = result.translation;
      updateStatus(true, '翻译完成', result.usage || 0);
    } else {
      UI.resultText.textContent = `❌ 发生错误: ${result.error}`;
      updateStatus(true, '请求失败');
    }
  } catch (e) {
    UI.resultText.textContent = `❌ 网络或接口异常: ${e.message}`;
    updateStatus(false, '连接异常');
  } finally {
    UI.btnExecute.disabled = false;
    UI.btnExecute.textContent = '执行翻译';
  }
}

/**
 * 初始化
 */
async function init() {
  if (!Bridge) {
    UI.resultText.textContent = '错误：Bridge API 未发现。请在普通模式下打开此面板。';
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
  UI.promptInput.value = Bridge.getInitialPrompt(UI.sourceInput.value, UI.langSelect.value);

  // 按钮事件
  UI.btnExecute.addEventListener('click', handleTranslate);
  UI.btnConfig.addEventListener('click', () => Bridge.openOllamaConfig());

  // 语言切换时自动更新提示词
  UI.langSelect.addEventListener('change', () => {
    UI.promptInput.value = Bridge.getInitialPrompt(UI.sourceInput.value, UI.langSelect.value);
  });

  // 实况状态检查
  const check = await Bridge.checkStatus();
  updateStatus(check.online, check.message);
  
  // 自动触发首次翻译
  if (UI.sourceInput.value.trim()) {
    handleTranslate();
  }
}

// 监听 Escape 键退出
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') Bridge.closePanel();
});

init();
