const fs = require('fs');
const path = require('path');

const MODES = [
    {
        id: 'offline_dict',
        title: '离线词典',
        description: '使用 ecdict 离线词典进行快速查词 (响应快)'
    },
    {
        id: 'helsinki_model',
        title: '离线翻译模型',
        description: '使用 Helsinki-NLP/opus-mt 模型进行整句翻译 (准确度高，需下载模型且耗时较长)'
    }
];

const STATUS = {
    READY: 'READY',
    UNAVAILABLE: 'UNAVAILABLE'
};

function getDictStatus(appConfig) {
    appConfig = appConfig || {};
    const repoPath = appConfig.resourcePath;
    if (!repoPath) {
        return { status: STATUS.UNAVAILABLE, path: '' };
    }

    const ecdictDbPath = path.join(repoPath, 'ecdict.db');
    const cccedictDbPath = path.join(repoPath, 'cccedict.db');

    const eReady = fs.existsSync(ecdictDbPath);
    const cReady = fs.existsSync(cccedictDbPath);

    if (eReady && cReady) return { status: STATUS.READY, path: repoPath };
    return { status: STATUS.UNAVAILABLE, path: repoPath };
}

function getModelStatus(appConfig) {
    appConfig = appConfig || {};
    // 模型状态暂时简单判定（可根据实际模型文件名称改进）
    const repoPath = appConfig.resourcePath || path.join(__dirname, '..', 'resources', 'models');
    // 如果存在 model.onnx 或 pytorch_model.bin 表示可以运行（这里简化，如果目录存在切不为空则认为READY）
    if (fs.existsSync(repoPath)) {
        try {
            const files = fs.readdirSync(repoPath);
            if (files.length > 0) return { status: STATUS.READY };
        } catch (e) {
            // ignore
        }
    }
    return { status: STATUS.UNAVAILABLE };
}


module.exports = {
    trigger: 'mode',
    title: '选择模式',
    description: '切换翻译使用的模型或离线词典 (/mode)',

    handleSearch(subInput, callbackSetList, appConfig) {
        const dictInfo = getDictStatus(appConfig);
        const modelInfo = getModelStatus(appConfig);

        const items = MODES.map(mode => {
            let statusText = '';
            let currentStatus = STATUS.UNAVAILABLE;
            let extInfo = {};
            if (mode.id === 'offline_dict') {
                currentStatus = dictInfo.status;
                extInfo = dictInfo;
                if (currentStatus === STATUS.READY) statusText = '(数据已就绪)';
                else statusText = '(词库未就绪或未配置路径)';
            } else if (mode.id === 'helsinki_model') {
                currentStatus = modelInfo.status;
                extInfo = modelInfo;
                if (currentStatus === STATUS.READY) statusText = '(已就绪)';
                else statusText = '(未下载)';
            }

            return {
                title: mode.title,
                description: `${mode.description} ${statusText}`,
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
        if (!itemData.modeId) return {};

        const status = itemData.currentStatus;

        if (status === STATUS.UNAVAILABLE) {
            let instructions = [];
            if (itemData.modeId === 'offline_dict') {
                instructions = [
                    { title: '缺少词典或未配置路径', description: '您必须在设置中配置词典的绝对路径，且该路径下需要包含 ecdict.db 与 cccedict.db' },
                    { title: '如何配置目录？', description: '您可以输入 /path 命令或者在设置页中设置资源路径' }
                ];
            } else {
                instructions = [
                    { title: '下载翻译模型', description: '请确保在资源目录中下载了 Helsinki-NLP/opus-mt 相关模型文件' },
                    { title: '如何配置目录？', description: '您可以输入 /path 命令或者在设置页中设置模型路径' }
                ];
            }
            if (typeof callbackSetList === 'function') {
                callbackSetList(instructions);
            }
            return { disableClear: true }; // 不做任何后端刷新与搜索恢复
        }

        // status === STATUS.READY
        // 变更应用配置
        if (itemData.modeId === 'offline_dict') {
            appConfig.backends.offline_dict = true;
            appConfig.backends.helsinki_model = false;
        } else if (itemData.modeId === 'helsinki_model') {
            appConfig.backends.offline_dict = false;
            appConfig.backends.helsinki_model = true;
        }

        // 持久化保存
        if (typeof utools !== 'undefined') {
            utools.dbStorage.setItem('app_config', appConfig);
        }

        // 返回副作用信号供 preload.js 消费
        return {
            reloadBackend: true,
            restoreSearch: true
        };
    }
};
