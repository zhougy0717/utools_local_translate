// 兼容在 iframe 中加载时，获取父级窗口的 utools 对象
if (typeof utools === 'undefined' && window.parent && window.parent.utools) {
    window.utools = window.parent.utools;
}

const UI = {
    apiBase: document.getElementById('apiBase'),
    modelSelect: document.getElementById('modelSelect'),
    prompt: document.getElementById('prompt'),
    btnRefresh: document.getElementById('btn-refresh-models'),
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
            apiBase: 'http://127.0.0.1:11434/v1',
            model: '',
            prompt: DEFAULT_PROMPT
        }
    };

    if (typeof utools !== 'undefined') {
        const storedConfig = utools.dbStorage.getItem('app_config');
        if (storedConfig) {
            appConfig = storedConfig;
            if (!appConfig.ollama) appConfig.ollama = {};
            if (!appConfig.ollama.apiBase) appConfig.ollama.apiBase = 'http://127.0.0.1:11434/v1';
            if (!appConfig.ollama.prompt) appConfig.ollama.prompt = DEFAULT_PROMPT;
        }
    }
    return appConfig;
}

function renderConfig(config) {
    UI.apiBase.value = config.ollama.apiBase || 'http://127.0.0.1:11434/v1';
    UI.prompt.value = config.ollama.prompt || DEFAULT_PROMPT;
    
    // 如果已有模型配置，先放进选项里，等待拉取后再更新
    if (config.ollama.model) {
        let exists = false;
        for (let i = 0; i < UI.modelSelect.options.length; i++) {
            if (UI.modelSelect.options[i].value === config.ollama.model) {
                exists = true;
                break;
            }
        }
        if (!exists) {
            const option = document.createElement('option');
            option.value = config.ollama.model;
            option.textContent = config.ollama.model;
            UI.modelSelect.appendChild(option);
        }
        UI.modelSelect.value = config.ollama.model;
    }
}

async function fetchModels() {
    const apiBase = UI.apiBase.value.trim();
    if (!apiBase) {
        showMessage('API Base URL 不能为空', true);
        return;
    }

    UI.btnRefresh.classList.add('rotating');
    UI.btnRefresh.disabled = true;

    try {
        // 请求 Ollama 的 /api/tags 获取模型列表 (注意这里不是 /v1 而是直接 /api/tags)
        // 从 apiBase 推断基础域名，例如 http://127.0.0.1:11434/v1 -> http://127.0.0.1:11434
        let baseUrl = apiBase;
        if (baseUrl.endsWith('/v1')) {
            baseUrl = baseUrl.substring(0, baseUrl.length - 3);
        } else if (baseUrl.endsWith('/v1/')) {
            baseUrl = baseUrl.substring(0, baseUrl.length - 4);
        }
        
        const response = await fetch(`${baseUrl}/api/tags`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        if (data && data.models && Array.isArray(data.models)) {
            // 保存当前选中的值
            const currentSelected = UI.modelSelect.value;
            
            UI.modelSelect.innerHTML = '<option value="" disabled>-- 请选择模型 --</option>';
            data.models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.name;
                option.textContent = model.name;
                UI.modelSelect.appendChild(option);
            });

            // 恢复选中
            if (currentSelected) {
                let exists = false;
                for(let i=0; i < UI.modelSelect.options.length; i++) {
                    if(UI.modelSelect.options[i].value === currentSelected) {
                        exists = true; break; 
                    }
                }
                if (exists) UI.modelSelect.value = currentSelected;
            } else if (data.models.length > 0) {
                // 默认选中第一个
                UI.modelSelect.value = data.models[0].name;
            }
            
            showMessage('模型列表已更新');
        } else {
            throw new Error('返回格式不正确');
        }
        
    } catch (error) {
        console.error('Fetch Models Error:', error);
        showMessage('无法获取模型，请确认 Ollama 已启动', true);
    } finally {
        UI.btnRefresh.classList.remove('rotating');
        UI.btnRefresh.disabled = false;
    }
}

function saveConfig() {
    if (typeof utools === 'undefined') {
        alert('仅在 uTools 环境下可用');
        return;
    }

    const config = loadConfig();
    config.ollama = {
        apiBase: UI.apiBase.value.trim() || 'http://127.0.0.1:11434/v1',
        model: UI.modelSelect.value || '',
        prompt: UI.prompt.value.trim() || DEFAULT_PROMPT
    };
    
    // 如果没有配置过后端偏好，默认在这里也切到 ollama
    if(!config.backends) config.backends = {};
    config.backends.ollama = true;
    config.backends.offline_dict = false;

    utools.dbStorage.setItem('app_config', config);
    showMessage('配置已保存 (需重新打开插件载入)');
    
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
UI.btnRefresh.addEventListener('click', fetchModels);
UI.btnSave.addEventListener('click', saveConfig);
UI.btnClose.addEventListener('click', closePanel);

// 初始化
const currentConfig = loadConfig();
renderConfig(currentConfig);

// 自动尝试拉取一遍模型
setTimeout(fetchModels, 300);
