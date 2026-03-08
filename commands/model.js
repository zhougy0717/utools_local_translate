const MODELS = [
    {
        id: 'helsinki-nlp/opus-mt',
        title: 'Helsinki-NLP (ONNX)',
        description: '当前内置基础模型。支持中英双向离线翻译。翻译质量：基础可用，适合简单字句和日常短句获取主干意思。'
    },
    {
        id: 'placeholder',
        title: 'HY-MT1.5B (待支持)',
        description: '预留的高性能模型，敬请期待。'
    }
];

module.exports = {
    trigger: 'model',
    title: '选择翻译模型',
    description: '切换底层用于推理翻译质量的大预言模型 (/model)',

    handleSearch(subInput, callbackSetList) {
        const items = MODELS.map(model => {
            return {
                title: model.title,
                description: model.description,
                isCommandContext: true,
                commandTrigger: 'model', // 标记给 index.js 路由回传
                modelId: model.id
            };
        });

        const fuzzyInput = subInput.trim().toLowerCase();
        const filteredItems = items.filter(item =>
            item.title.toLowerCase().includes(fuzzyInput) ||
            item.description.toLowerCase().includes(fuzzyInput)
        );

        callbackSetList(filteredItems);
    },

    handleSelect(itemData, appConfig) {
        if (!itemData.modelId || itemData.modelId === 'placeholder') return {};

        // 仅大模型模式下才需要应用，这里更新配置中的 selected_model (设计兼容)
        if (!appConfig.backends) {
            appConfig.backends = {};
        }
        appConfig.backends.selected_model = itemData.modelId;

        // 持久化保存
        if (typeof utools !== 'undefined') {
            utools.dbStorage.setItem('app_config', appConfig);
        }

        return {
            reloadBackend: true,
            restoreSearch: true
        };
    }
};
