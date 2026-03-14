// 兼容在 iframe 中加载时，获取父级窗口的 utools 对象
if (typeof utools === 'undefined' && window.parent && window.parent.utools) {
    window.utools = window.parent.utools;
}

const UI = {
    prompt: document.getElementById('prompt'),
    btnSave: document.getElementById('btn-save'),
    btnClose: document.getElementById('btn-close'),
    statusMessage: document.getElementById('status-message')
};

const DEFAULT_PROMPT = '你是一个专业的翻译助手。请将以下文本翻译为${target_lang}。只输出翻译结果，不要输出任何解释说明。';

function showMessage(text, isError = false) {
    UI.statusMessage.textContent = text;
    UI.statusMessage.className = isError ? 'status-error' : 'status-success';
    setTimeout(() => {
        UI.statusMessage.textContent = '';
    }, 3000);
}

function loadConfig() {
    let appConfig = {
        ollama: {
            prompt: DEFAULT_PROMPT
        }
    };

    if (typeof utools !== 'undefined') {
        const storedConfig = utools.dbStorage.getItem('app_config');
        if (storedConfig) {
            appConfig = storedConfig;
            if (!appConfig.ollama) appConfig.ollama = {};
            if (!appConfig.ollama.prompt) appConfig.ollama.prompt = DEFAULT_PROMPT;
        }
    }
    return appConfig;
}

function renderConfig(config) {
    UI.prompt.value = config.ollama.prompt || DEFAULT_PROMPT;
}

function saveConfig() {
    if (typeof utools === 'undefined') {
        alert('仅在 uTools 环境下可用');
        return;
    }

    const config = loadConfig();
    // 只更新 prompt，保持其他配置不变
    config.ollama.prompt = UI.prompt.value.trim() || DEFAULT_PROMPT;

    utools.dbStorage.setItem('app_config', config);
    showMessage('配置已保存');

    // 延迟一点关闭
    setTimeout(() => {
        closePanel();
    }, 1000);
}

function closePanel() {
    if (window.parent && typeof window.parent.hideOllamaConfig === 'function') {
        window.parent.hideOllamaConfig();
    } else {
        // 如果是从普通 iframe 环境进来获取了父窗口的 document
        const iframeContainer = window.parent.document.getElementById('ollama-config-container');
        if (iframeContainer) {
            iframeContainer.style.display = 'none';
        }
    }
}

// 事件绑定
UI.btnSave.addEventListener('click', saveConfig);
UI.btnClose.addEventListener('click', closePanel);

// 初始化
const currentConfig = loadConfig();
renderConfig(currentConfig);
