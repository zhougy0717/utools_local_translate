module.exports = {
    trigger: 'proxy',
    title: '代理设置',
    description: '设置网络代理服务器，用于连接网络 (/proxy)',

    handleSearch(subInput, callbackSetList, appConfig) {
        const currentProxy = appConfig.proxy || '未设置';
        const items = [];

        // 1. 显示当前状态
        items.push({
            title: `当前代理状态: ${currentProxy}`,
            description: '输入新的代理地址 (如 http://127.0.0.1:7890) 并回车进行设置',
            isCommandContext: true,
            commandTrigger: 'proxy',
            action: 'status'
        });

        // 2. 如果输入了内容，提供设置选项
        const input = subInput.trim();
        if (input) {
            // 简单校验一下 input 是否像一个代理地址
            let isValid = true;
            try {
                if (input.includes('://')) {
                    new URL(input);
                }
            } catch (e) {
                isValid = false;
            }

            items.push({
                title: `设置代理为: ${input}`,
                description: isValid ? '点击或回车确认' : '输入的格式可能不正确，请检查',
                isCommandContext: true,
                commandTrigger: 'proxy',
                action: 'set',
                value: input
            });
        }

        // 3. 提供清除选项
        if (appConfig.proxy) {
            items.push({
                title: '清除代理设置',
                description: '移除当前代理，恢复直连模式',
                isCommandContext: true,
                commandTrigger: 'proxy',
                action: 'clear'
            });
        }

        callbackSetList(items);
    },

    handleSelect(itemData, appConfig) {
        if (!itemData.action || itemData.action === 'status') return {};

        if (itemData.action === 'set') {
            appConfig.proxy = itemData.value;
            if (typeof utools !== 'undefined') {
                utools.dbStorage.setItem('app_config', appConfig);
                utools.showNotification(`代理设置成功: ${itemData.value}`);
            }
            return {
                reloadBackend: true,
                restoreSearch: true 
            };
        } else if (itemData.action === 'clear') {
            appConfig.proxy = '';
            if (typeof utools !== 'undefined') {
                utools.dbStorage.setItem('app_config', appConfig);
                utools.showNotification('代理设置已清除');
            }
            return {
                reloadBackend: true,
                restoreSearch: true
            };
        }

        return {};
    }
};
