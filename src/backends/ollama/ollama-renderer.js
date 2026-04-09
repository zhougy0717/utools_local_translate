/**
 * Ollama 配置界面渲染器
 * 核心原则：解耦。所有业务逻辑通过 window.parent._ollamaAPI 桥接完成。
 */

const Bridge = window.parent._ollamaAPI;

const UI = {
    apiBase: document.getElementById('apiBase'),
    apiKey: document.getElementById('apiKey'),
    modelSelect: document.getElementById('model-select'),
    visionModelSelect: document.getElementById('vision-model-select'),
    btnRefreshModels: document.getElementById('btn-refresh-models'),
    prompt: document.getElementById('prompt'),
    proxyLabel: document.getElementById('proxy-label'),
    proxyDetails: document.getElementById('proxy-details'),
    proxyToggle: document.getElementById('proxy-toggle'),
    btnConfigProxy: document.getElementById('btn-config-proxy'),
    btnTest: document.getElementById('btn-test'),
    statusMessage: document.getElementById('status-message'),
    connectionStatus: document.getElementById('connection-status'),
    headerStatusText: document.getElementById('header-status-text')
};

function showMessage(text, type = 'success') {
    UI.statusMessage.textContent = text;
    UI.statusMessage.className = `msg-${type}`;
    UI.statusMessage.style.display = 'block';
    
    if (type !== 'loading') {
        setTimeout(() => {
            UI.statusMessage.style.display = 'none';
        }, 3500);
    }
}

/**
 * 更新页眉连通性指示器
 */
function updateHeaderStatus(isOnline, text) {
    UI.connectionStatus.className = `status-dot ${isOnline ? 'online' : 'offline'}`;
    UI.headerStatusText.textContent = text || (isOnline ? '已就绪' : '未连接');
}

/**
 * 填充模型下拉列表
 */
function populateModels(models, currentModel = '', currentVisionModel = '') {
    UI.modelSelect.innerHTML = '';
    UI.visionModelSelect.innerHTML = '';

    if (!models || models.length === 0) {
        const placeholder = '未找到可用模型 (请先测试连接)';
        [UI.modelSelect, UI.visionModelSelect].forEach(select => {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = placeholder;
            select.appendChild(opt);
        });
        return;
    }

    models.forEach(name => {
        // 为文本模型填充
        const optText = document.createElement('option');
        optText.value = name;
        optText.textContent = name;
        if (name === currentModel) optText.selected = true;
        UI.modelSelect.appendChild(optText);

        // 为图片模型填充
        const optVision = document.createElement('option');
        optVision.value = name;
        optVision.textContent = name;
        if (name === currentVisionModel) optVision.selected = true;
        UI.visionModelSelect.appendChild(optVision);
    });
}

function updateProxyUI(globalStatus, globalAddr, ollamaProxyEnabled) {
    if (globalStatus) {
        UI.proxyDetails.textContent = `开启后将通过全局代理进行请求（当前地址: ${globalAddr}）。`;
    } else {
        UI.proxyDetails.textContent = `当前全局代理未配置。如遇连接失败，请点击链接配置全局代理。`;
    }

    UI.proxyLabel.classList.toggle('active', ollamaProxyEnabled);
    UI.proxyLabel.textContent = ollamaProxyEnabled ? 'ON' : 'OFF';
}

/**
 * 初始化并加载配置
 */
async function init() {
    if (!Bridge) return;
    const config = Bridge.loadConfig();
    
    // 填充字段
    UI.apiBase.value = config.apiBase || '';
    UI.apiKey.value = config.apiKey || '';
    UI.prompt.value = config.prompt || '';
    UI.proxyToggle.checked = config.useProxy || false;

    // 填充模型列表并初始化位置
    populateModels(config.models || [], config.model, config.visionModel);
    
    // 如果缓存的模型不在列表里，手动追加
    if (!UI.modelSelect.value && config.model) {
        const opt = document.createElement('option');
        opt.value = config.model;
        opt.textContent = `${config.model} (缓存)`;
        opt.selected = true;
        UI.modelSelect.prepend(opt);
    }
    if (!UI.visionModelSelect.value && config.visionModel) {
        const opt = document.createElement('option');
        opt.value = config.visionModel;
        opt.textContent = `${config.visionModel} (缓存)`;
        opt.selected = true;
        UI.visionModelSelect.prepend(opt);
    }

    updateProxyUI(config.globalProxyStatus, config.globalProxyAddr, config.useProxy);
    handleRefreshModels(true);
}

/**
 * 保存配置
 */
function handleSave(shouldClose = false) {
    const config = {
        apiBase: UI.apiBase.value.trim(),
        apiKey: UI.apiKey.value.trim(),
        model: UI.modelSelect.value,
        visionModel: UI.visionModelSelect.value,
        prompt: UI.prompt.value.trim(),
        useProxy: UI.proxyToggle.checked,
        models: Array.from(UI.modelSelect.options).map(opt => opt.value).filter(v => v)
    };

    if (Bridge.saveConfig(config)) {
        if (shouldClose) {
            Bridge.closePanel();
        }
    }
}

/**
 * 测试连接并刷新模型 (同时联动保存)
 */
async function handleRefreshModels(silent = false) {
    const apiBase = UI.apiBase.value.trim();
    const apiKey = UI.apiKey.value.trim();

    if (!apiBase) {
        if (!silent) showMessage('请先填写 API Base URL', 'error');
        updateHeaderStatus(false, '未配置地址');
        return;
    }

    let baseUrl = apiBase.replace(/\/+$/, '');

    if (!silent) showMessage('正在连接服务器并获取模型列表...', 'loading');
    updateHeaderStatus(false, '检查中...');

    const result = await Bridge.testConnection(baseUrl, apiKey);
    
    if (result.success) {
        const models = result.models || [];
        populateModels(models, UI.modelSelect.value, UI.visionModelSelect.value);
        
        // 成功获取模型后，执行一次自动保存（更新模型列表缓存）
        handleSave(false);

        if (!silent) showMessage(`✅ 连接成功! 发现 ${models.length} 个模型。`, 'success');
        updateHeaderStatus(true, `已联通 (发现 ${models.length} 个模型)`);
        return true;
    } else {
        if (!silent) showMessage(`❌ 连接失败: ${result.error}`, 'error');
        updateHeaderStatus(false, '连接异常');
        return false;
    }
}

// 事件绑定：即时保存
const inputIds = ['apiBase', 'apiKey', 'model-select', 'vision-model-select', 'prompt', 'proxy-toggle'];
inputIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', () => {
        handleSave(false);
        if (id === 'apiBase' || id === 'apiKey') handleRefreshModels(true);
        if (id === 'proxy-toggle') {
            const config = Bridge.loadConfig();
            updateProxyUI(config.globalProxyStatus, config.globalProxyAddr, UI.proxyToggle.checked);
        }
    });
});

// 核心操作按钮：绿色勾选按钮
UI.btnTest.addEventListener('click', async () => {
    // 1. 点击时视觉反馈
    UI.btnTest.style.transform = 'scale(0.9)';
    setTimeout(() => UI.btnTest.style.transform = 'scale(1)', 100);

    // 2. 执行测试并自动保存
    await handleRefreshModels(false);
});

UI.btnRefreshModels.addEventListener('click', () => handleRefreshModels(false));
UI.btnConfigProxy.addEventListener('click', () => Bridge.openGlobalProxyConfig());

// 快捷退出：ESC
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') Bridge.closePanel();
});

// 启动
init();
