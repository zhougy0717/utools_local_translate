module.exports = {
    trigger: 'proxy',
    title: '代理设置',
    description: '设置网络代理服务器，用于连接网络 (/proxy)',

    handleSearch(subInput, callbackSetList, appConfig) {
        const proxy = appConfig.proxy || {};
        const enabled = proxy.enabled;
        const type = proxy.type === 'socks5' ? 'SOCKS5' : 'HTTP';
        const address = proxy.host ? `${proxy.host}:${proxy.port}` : '未配置';

        const items = [];

        // 1. 显示当前状态
        items.push({
            title: `代理状态: ${enabled ? '已启用 (' + type + ')' : '已禁用'}`,
            description: enabled ? `当前地址: ${address} | 点击这里修改配置` : '点击这里进入代理配置界面',
            isCommandContext: true,
            commandTrigger: 'proxy',
            action: 'open_panel'
        });

        // 2. 快捷清除选项 (如果已启用)
        if (enabled) {
            items.push({
                title: '一键禁用代理',
                description: '快速关闭代理并恢复直连',
                isCommandContext: true,
                commandTrigger: 'proxy',
                action: 'disable'
            });
        }

        callbackSetList(items);
    },

    handleSelect(itemData, appConfig) {
        if (itemData.action === 'open_panel') {
            return {
                openProxyConfigPanel: true
            };
        }

        if (itemData.action === 'disable') {
            const proxy = Object.assign({}, appConfig.proxy || {});
            proxy.enabled = false;
            appConfig.save({ proxy });
            if (typeof utools !== 'undefined') {
                utools.showNotification('网络代理已禁用');
            }
            return {
                reloadBackend: true,
                restoreSearch: true
            };
        }

        return {};
    }
};
