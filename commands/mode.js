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

module.exports = {
    trigger: 'mode',
    title: '选择模式',
    description: '切换翻译使用的模型或离线词典',

    handleSearch(subInput, callbackSetList) {
        const items = MODES.map(mode => {
            return {
                title: mode.title,
                description: mode.description,
                isCommandContext: true,
                commandTrigger: 'mode', // 标记给 index.js 路由回传
                modeId: mode.id
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

    handleSelect(itemData, appConfig) {
        if (!itemData.modeId) return {};

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
