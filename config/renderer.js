// 兼容在 iframe 中加载时，获取父级窗口的 utools 对象
if (typeof utools === 'undefined' && window.parent && window.parent.utools) {
    window.utools = window.parent.utools;
}

const UI = {
    resourcePath: document.getElementById('resourcePath'),
    btnSelectPath: document.getElementById('btnSelectPath'),
    backendOfflineDict: document.getElementById('backendOfflineDict'),
    backendHelsinkiModel: document.getElementById('backendHelsinkiModel'),
    btnSave: document.getElementById('btnSave'),
};

const DEFAULT_CONFIG = {
    _id: 'app_config',
    resourcePath: '',
    backends: {
        offline_dict: true,
        helsinki_model: false
    }
};

function loadConfig() {
    if (typeof utools === 'undefined') return DEFAULT_CONFIG;
    const config = utools.dbStorage.getItem('app_config');
    return config || DEFAULT_CONFIG;
}

function renderConfig(config) {
    UI.resourcePath.value = config.resourcePath || '';
    UI.backendOfflineDict.checked = config.backends?.offline_dict ?? true;
    UI.backendHelsinkiModel.checked = config.backends?.helsinki_model ?? false;
}

function saveConfig() {
    if (typeof utools === 'undefined') {
        alert('仅在 uTools 环境下可用');
        return;
    }

    const config = {
        _id: 'app_config',
        resourcePath: UI.resourcePath.value,
        backends: {
            offline_dict: UI.backendOfflineDict.checked,
            helsinki_model: UI.backendHelsinkiModel.checked
        }
    };

    utools.dbStorage.setItem('app_config', config);
    utools.showNotification('配置已保存');
}

// 事件绑定
UI.btnSelectPath.addEventListener('click', () => {
    if (typeof utools !== 'undefined') {
        const paths = utools.showOpenDialog({
            properties: ['openDirectory'],
            title: '选择资源下载路径'
        });
        if (paths && paths.length > 0) {
            UI.resourcePath.value = paths[0];
        }
    } else {
        alert('开发环境下无法调用系统对话框');
    }
});

UI.btnSave.addEventListener('click', saveConfig);

// 初始化
const config = loadConfig();
renderConfig(config);
