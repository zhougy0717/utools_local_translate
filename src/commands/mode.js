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


const Icons = require('./icons.js');

module.exports = {
    trigger: 'mode',
    title: '选择翻译模式',
    description: '切换翻译使用的模型或离线词典 (/mode)',

    handleSearch(subInput, callbackSetList, appConfig) {
        const dictInfo = getDictStatus(appConfig);
        const liveAppConfig = (typeof utools !== 'undefined' ? utools.dbStorage.getItem('app_config') : null) || appConfig;
        const currentActive = liveAppConfig.backends || {};

        const items = MODES.map(mode => {
            let statusText = '';
            let statusPrefix = '⚠️';
            let currentStatus = STATUS.UNAVAILABLE;
            let extInfo = {};
            let icon = Icons.DICT;

            // 获取各模式具体状态
            if (mode.id === 'offline_dict') {
                currentStatus = dictInfo.status;
                extInfo = dictInfo;
                if (currentStatus === STATUS.READY) {
                    statusText = '数据已就绪';
                    statusPrefix = '✅';
                } else {
                    statusText = '未就绪，点击配置';
                }
                icon = Icons.DICT;
            } else if (mode.id === 'ollama') {
                const ollamaInfo = getOllamaStatus(appConfig);
                currentStatus = ollamaInfo.status;
                extInfo = ollamaInfo;
                if (currentStatus === STATUS.READY) {
                    statusText = '服务已联通';
                    statusPrefix = '✅';
                } else {
                    statusText = '未配置 API 地址或模型';
                }
                icon = Icons.OLLAMA;
            } else if (mode.id === 'libretranslate') {
                const libreInfo = getLibreStatus(appConfig);
                currentStatus = libreInfo.status;
                extInfo = libreInfo;
                if (currentStatus === STATUS.READY) {
                    statusText = 'API 已就绪';
                    statusPrefix = '✅';
                } else {
                    statusText = '未配置服务地址';
                }
                icon = Icons.LIBRE;
            }

            // 检查当前是否激活
            const isActive = !!currentActive[mode.id];
            const activeSuffix = isActive ? ' (已激活 🌟)' : '';

            return {
                title: `${mode.title}${activeSuffix}`,
                description: `${statusPrefix} ${statusText} — ${mode.description}`,
                isCommandContext: true,
                commandTrigger: 'mode',
                modeId: mode.id,
                currentStatus: currentStatus,
                extInfo: extInfo,
                icon: icon
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
        // 1.1 处理离线词典的二级确认逻辑 (spec-00033)
        if (itemData.modeId === 'offline_dict' && !itemData.action) {
            const liveAppConfig = (typeof utools !== 'undefined' ? utools.dbStorage.getItem('app_config') : null) || appConfig;
            const dictInfo = getDictStatus(liveAppConfig);
            const statusText = dictInfo.status === STATUS.READY ? '✅ 数据已就绪' : '⚠️ 数据未就绪';
            
            callbackSetList([
                {
                    title: '确认启用离线词典翻译模式',
                    description: `当前状态: ${statusText} — ECDICT 万词库，极速本地响应`,
                    isCommandContext: true,
                    commandTrigger: 'mode',
                    modeId: 'offline_dict',
                    action: 'confirm_dict',
                    icon: Icons.DICT
                },
                {
                    title: '打开离线词典配置面板',
                    description: `⚙️ 管理词典数据与下载状态`,
                    isCommandContext: true,
                    commandTrigger: 'mode',
                    modeId: 'offline_dict',
                    action: 'open_dict_config',
                    icon: Icons.DICT
                }
            ]);
            return { disableClear: true };
        }

        // 1.2 处理 Ollama 的子命令导航逻辑 (导航组织模式，而非仅为确认)
        if (itemData.modeId === 'ollama' && !itemData.action) {
            const configManager = new OllamaConfig();
            const config = configManager.load();
            const modelName = config.model || '未选择模型';
            const apiBase = config.apiBase || '未配置地址';

            callbackSetList([
                {
                    title: '确认启用 Ollama 翻译模式',
                    description: `当前模型: ${modelName}`,
                    isCommandContext: true,
                    commandTrigger: 'mode',
                    modeId: 'ollama',
                    action: 'confirm_ollama',
                    icon: Icons.OLLAMA
                },
                {
                    title: '打开 Ollama 配置面板',
                    description: `API: ${apiBase}`,
                    isCommandContext: true,
                    commandTrigger: 'mode',
                    modeId: 'ollama',
                    action: 'open_ollama_config',
                    icon: Icons.OLLAMA
                }
            ]);
            return { disableClear: true };
        }

        // 2.1 处理离线词典的具体子操作
        if (itemData.action === 'confirm_dict') {
            appConfig.backends.offline_dict = true;
            appConfig.backends.ollama = false;
            appConfig.backends.libretranslate = false;
            if (typeof utools !== 'undefined') utools.dbStorage.setItem('app_config', appConfig);
            return { reloadBackend: true, restoreSearch: true };
        }

        if (itemData.action === 'open_dict_config') {
            appConfig.backends.offline_dict = true;
            appConfig.backends.ollama = false;
            appConfig.backends.libretranslate = false;
            if (typeof utools !== 'undefined') utools.dbStorage.setItem('app_config', appConfig);
            return { openConfigPanel: true, reloadBackend: true };
        }

        // 2.2 处理 Ollama 的具体子操作
        if (itemData.action === 'confirm_ollama') {
            appConfig.backends.offline_dict = false;
            appConfig.backends.ollama = true;
            appConfig.backends.libretranslate = false;
            if (typeof utools !== 'undefined') utools.dbStorage.setItem('app_config', appConfig);
            return { reloadBackend: true, restoreSearch: true };
        }

        if (itemData.action === 'open_ollama_config') {
            // 关键：切换活跃标记到 Ollama，否则重载后依然是上一个后端
            appConfig.backends.offline_dict = false;
            appConfig.backends.ollama = true;
            appConfig.backends.libretranslate = false;
            if (typeof utools !== 'undefined') {
                utools.dbStorage.setItem('app_config', appConfig);
            }
            return { openConfigPanel: true, reloadBackend: true };
        }

        // 3. 处理常规模式逻辑 (及原有 Fallback)
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
            } else if (itemData.modeId === 'libretranslate') {
                // LibreTranslate 目前仅提示指令 (spec-00032)
                callbackSetList([
                    { 
                        title: '配置 LibreTranslate', 
                        description: '设置服务器地址与 API Key (/libre <url> [key])',
                        icon: Icons.LIBRE
                    }
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

