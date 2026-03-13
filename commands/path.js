const PATH_OPTIONS = [
    {
        id: 'default',
        title: '默认路径',
        description: '重置并使用插件内置的数据存储路径'
    },
    {
        id: 'custom',
        title: '选择自定义路径...',
        description: '在弹窗中选择一个包含离线词典/AI模型的新文件夹'
    }
];

module.exports = {
    trigger: 'path',
    title: '存储路径',
    description: '重置或自定义指定离线数据的存储加载路径 (/path)',

    handleSearch(subInput, callbackSetList) {
        // 为了体验，我们可以动态读取配置来更新默认展示状态
        let currentPath = '';
        if (typeof utools !== 'undefined') {
            const config = utools.dbStorage.getItem('app_config') || {};
            currentPath = config.resourcePath || '';
        }

        const items = PATH_OPTIONS.map(opt => {
            const isCustom = opt.id === 'custom';
            // 如果是自定义路径项，且当前本身就有自定义路径，把当前路径显示在子标题上。
            const dynamicDesc = (isCustom && currentPath)
                ? `当前自定义路径: ${currentPath}`
                : opt.description;

            return {
                title: dynamicDesc,
                description: opt.title,
                isCommandContext: true,
                commandTrigger: 'path', // 标记给 index.js 路由回传
                pathAction: opt.id
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
        if (!itemData.pathAction) return {};

        if (itemData.pathAction === 'default') {
            // 清理掉 resourcePath
            appConfig.resourcePath = '';
            if (typeof utools !== 'undefined') {
                utools.dbStorage.setItem('app_config', appConfig);
            }
            return {
                reloadBackend: true,
                restoreSearch: true
            };
        } else if (itemData.pathAction === 'custom') {
            // 调用 uTools 弹出路径选择对话框
            if (typeof utools !== 'undefined') {
                const selectedPaths = utools.showOpenDialog({
                    title: "选择数据存储目录",
                    properties: ["openDirectory"]
                });

                if (selectedPaths && selectedPaths.length > 0) {
                    appConfig.resourcePath = selectedPaths[0];
                    utools.dbStorage.setItem('app_config', appConfig);

                    return {
                        reloadBackend: true,
                        restoreSearch: true
                    };
                }
            }
        }

        // 没做任何修改或者是取消选取，则什么阶段响应也不返回
        return {};
    }
};
