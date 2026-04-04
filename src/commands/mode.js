const fs = require('fs');
const { OllamaConfig } = require('../backends/ollama/config');
const { getDictStatus: getBackendDictStatus, DICT_STATUS } = require('../backends/dict');

const MODES = [
    {
        id: 'offline_dict',
        title: '离线词典',
        description: '使用 ecdict 离线词典进行快速查词 (响应快)'
    },
    {
        id: 'ollama',
        title: 'Ollama (LLM)',
        description: '使用 Ollama 或是兼容 OpenAI 格式的 API 进行翻译 (可定制 Prompt)'
    },
    {
        id: 'libretranslate',
        title: 'LibreTranslate (OSS)',
        description: '使用开源的 LibreTranslate API 进行翻译 (可私有部署)'
    }
];

const STATUS = {
    READY: 'READY',
    UNAVAILABLE: 'UNAVAILABLE',
    DOWNLOADING: 'DOWNLOADING',
    DOWNLOADED_UNPROCESSED: 'DOWNLOADED_UNPROCESSED'
};

function getDictStatus(appConfig) {
    // 使用后端模块的状态检测
    const dictStatus = getBackendDictStatus(appConfig);
    // 直接映射 DICT_STATUS 到 STATUS
    return {
        status: dictStatus.status,
        path: dictStatus.path,
        details: dictStatus.details
    };
}

function getOllamaStatus(_appConfig) {
    // 从 backend_ollama 存储键读取 Ollama 配置
    const configManager = new OllamaConfig();
    const ollamaConfig = configManager.load();
    // 基本依赖 apiBase 和 model 两个配置项
    if (ollamaConfig.apiBase && ollamaConfig.model) {
        return { status: STATUS.READY };
    }
    return { status: STATUS.UNAVAILABLE };
}

function getLibreStatus(appConfig) {
    appConfig = appConfig || {};
    const libreConfig = appConfig.libretranslate || {};
    if (libreConfig.apiBase) {
        return { status: STATUS.READY };
    }
    return { status: STATUS.UNAVAILABLE };
}


module.exports = {
    trigger: 'mode',
    title: '选择模式',
    description: '切换翻译使用的模型或离线词典 (/mode)',

    handleSearch(subInput, callbackSetList, appConfig) {
        const dictInfo = getDictStatus(appConfig);

        const items = MODES.map(mode => {
            let statusText = '';
            let currentStatus = STATUS.UNAVAILABLE;
            let extInfo = {};
            if (mode.id === 'offline_dict') {
                currentStatus = dictInfo.status;
                extInfo = dictInfo;
                if (currentStatus === STATUS.READY) {
                    statusText = '(数据已就绪)';
                } else {
                    statusText = '(未就绪，点击配置)';
                }
            } else if (mode.id === 'ollama') {
                const ollamaInfo = getOllamaStatus(appConfig);
                currentStatus = ollamaInfo.status;
                extInfo = ollamaInfo;
                if (currentStatus === STATUS.READY) statusText = '(已配置)';
                else statusText = '(未配置 API)';
            } else if (mode.id === 'libretranslate') {
                const libreInfo = getLibreStatus(appConfig);
                currentStatus = libreInfo.status;
                extInfo = libreInfo;
                if (currentStatus === STATUS.READY) statusText = '(已配置)';
                else statusText = '(未配置地址)';
            }

            return {
                title: `${mode.description} ${statusText}`,
                description: mode.title,
                isCommandContext: true,
                commandTrigger: 'mode', // 标记给 index.js 路由回传
                modeId: mode.id,
                currentStatus: currentStatus,
                extInfo: extInfo
            };
        });

        // 如果用户在 /mode 后继续输入，我们可以基于子输入进行简单筛选
        const fuzzyInput = subInput.trim().toLowerCase();
        const filteredItems = items.filter(item =>
            item.title.toLowerCase().includes(fuzzyInput) ||
            item.description.toLowerCase().includes(fuzzyInput)
        );

        callbackSetList(filteredItems);
    },

    handleSelect(itemData, appConfig, callbackSetList) {
        if (itemData.action === 'open_libre_docs') {
            if (typeof utools !== 'undefined') {
                utools.shellOpenExternal('https://docs.libretranslate.com/');
            }
            return { restoreSearch: true };
        }

        if (!itemData.modeId) return {};

        // 强行从底层同步实时配置
        const liveAppConfig = (typeof utools !== 'undefined' ? utools.dbStorage.getItem('app_config') : null) || appConfig;
        
        let status = itemData.currentStatus;
        if (itemData.modeId === 'offline_dict') {
            const dictStatus = getDictStatus(liveAppConfig);
            status = dictStatus.status;
        } else if (itemData.modeId === 'ollama') {
            status = getOllamaStatus(liveAppConfig).status;
        } else if (itemData.modeId === 'libretranslate') {
            status = getLibreStatus(liveAppConfig).status;
        }

        // 处理未就绪状态：统一唤起配置面板
        if (status === STATUS.UNAVAILABLE || status === STATUS.DOWNLOADING || status === STATUS.DOWNLOADED_UNPROCESSED) {
            // 只要点击了该模式，就尝试将其设为 active 并在配置后生效
            appConfig.backends.offline_dict = (itemData.modeId === 'offline_dict');
            appConfig.backends.ollama = (itemData.modeId === 'ollama');
            appConfig.backends.libretranslate = (itemData.modeId === 'libretranslate');
            
            if (typeof utools !== 'undefined') {
                utools.dbStorage.setItem('app_config', appConfig);
            }

            if (itemData.modeId === 'offline_dict' || itemData.modeId === 'ollama') {
                // 这两者支持内置配置面板
                return { openConfigPanel: true, reloadBackend: true };
            } else if (itemData.id === 'libretranslate') {
                // LibreTranslate 目前仅提示指令
                callbackSetList([
                    { title: 'LibreTranslate 未配置', description: '请输入 /libre 命令进行配置' }
                ]);
                return { disableClear: true };
            }
        }

        // 状态就绪：直接切换
        appConfig.backends.offline_dict = (itemData.modeId === 'offline_dict');
        appConfig.backends.ollama = (itemData.modeId === 'ollama');
        appConfig.backends.libretranslate = (itemData.modeId === 'libretranslate');

        if (typeof utools !== 'undefined') {
            utools.dbStorage.setItem('app_config', appConfig);
        }

        return {
            reloadBackend: true,
            restoreSearch: true
        };
    }
};

