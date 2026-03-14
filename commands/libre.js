const UtoolsHelper = require('../src/utils/utools_helper');

module.exports = {
    trigger: 'libre',
    title: '配置 LibreTranslate',
    description: '设置 LibreTranslate 服务器地址和 API Key (/libre <url> [key])',

    handleSearch(subInput, callbackSetList, appConfig) {
        const input = subInput.trim();
        const parts = input.split(/\s+/);
        const inputApiBase = parts[0] || '';
        const inputApiKey = parts[1] || '';

        const items = [
            {
                title: '访问 LibreTranslate 官网文档',
                description: '查看如何使用 pip 或 Docker 部署本地翻译服务器 (https://docs.libretranslate.com/)',
                isCommandContext: true,
                commandTrigger: 'libre',
                action: 'open_docs'
            }
        ];

        // 优先显示已配置的服务器
        const currentApiBase = appConfig.libretranslate?.apiBase;
        const currentApiKey = appConfig.libretranslate?.apiKey;

        if (!input && currentApiBase) {
            const currentItem = {
                title: `当前配置: ${currentApiBase}`,
                description: '正在检测连通性...',
                isCommandContext: true,
                commandTrigger: 'libre',
                action: 'save_and_test', // 允许再次点击并保存/激活
                apiBase: currentApiBase,
                apiKey: currentApiKey
            };
            items.unshift(currentItem);
            
            // 引导列表渲染预览
            callbackSetList(items);

            // 异步检测连通性
            const endpoint = `${currentApiBase.replace(/\/+$/, '')}/languages`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000); // 列表页自动检测设为 2s 超时

            fetch(endpoint, { 
                method: 'GET',
                signal: controller.signal,
                headers: currentApiKey ? { 'Authorization': `Bearer ${currentApiKey}` } : {}
            })
            .then(res => {
                clearTimeout(timeoutId);
                // 创建新对象触发渲染
                const updatedItems = items.map(it => {
                    if (it === currentItem) {
                        return { ...it, description: res.ok ? '🟢 服务器连接正常' : `❌ 服务器响应异常 (状态码: ${res.status})` };
                    }
                    return it;
                });
                callbackSetList(updatedItems);
            })
            .catch(err => {
                clearTimeout(timeoutId);
                const isTimeout = err.name === 'AbortError';
                const updatedItems = items.map(it => {
                    if (it === currentItem) {
                        return { ...it, description: isTimeout ? '❌ 连接超时 (2s)' : `❌ 无法连接到服务器: ${err.message}` };
                    }
                    return it;
                });
                callbackSetList(updatedItems);
            });
            return;
        }

        if (inputApiBase) {
            items.unshift({
                title: `保存并检测: ${inputApiBase}`,
                description: inputApiKey ? `使用 API Key: ${inputApiKey}` : '不使用 API Key',
                isCommandContext: true,
                commandTrigger: 'libre',
                action: 'save_and_test',
                apiBase: inputApiBase,
                apiKey: inputApiKey
            });
        } else {
            items.unshift({
                title: '请输入 LibreTranslate 服务器地址',
                description: '例如: http://127.0.0.1:5000',
                isCommandContext: true,
                commandTrigger: 'libre',
                action: 'none'
            });
        }

        callbackSetList(items);
    },

    async handleSelect(itemData, appConfig, callbackSetList) {
        if (itemData.action === 'open_docs') {
            if (typeof utools !== 'undefined') {
                utools.shellOpenExternal('https://docs.libretranslate.com/');
            }
            return { restoreSearch: true };
        }

        if (itemData.action === 'save_and_test') {
            const { apiBase, apiKey } = itemData;
            
            // 提示检测中
            callbackSetList([{ title: '正在检测服务器连通性...', description: apiBase }]);

            try {
                const endpoint = `${apiBase.replace(/\/+$/, '')}/languages`;
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2000); // 手动确认也改为 2s 超时

                const response = await fetch(endpoint, { 
                    signal: controller.signal,
                    headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}
                });
                
                clearTimeout(timeoutId);

                if (response.ok) {
                    // 更新配置
                    appConfig.libretranslate.apiBase = apiBase;
                    appConfig.libretranslate.apiKey = apiKey;
                    appConfig.backends.libretranslate = true;
                    // 切换时关闭其他后端
                    appConfig.backends.ollama = false;
                    appConfig.backends.offline_dict = false;

                    if (typeof utools !== 'undefined') {
                        utools.dbStorage.setItem('app_config', appConfig);
                        utools.showNotification('LibreTranslate 配置成功并已启用');
                    }

                    // 成功后更新列表项显示，让用户直观看到结果
                    callbackSetList([{ 
                        title: '🟢 连接成功', 
                        description: `服务器 ${apiBase} 响应正常，配置已保存并启用。` 
                    }]);

                    // 停留一小会儿让用户看清状态，再自动返回或清理
                    await new Promise(resolve => setTimeout(resolve, 1000));

                    return {
                        reloadBackend: true,
                        restoreSearch: true
                    };
                } else {
                    throw new Error(`HTTP 状态码: ${response.status}`);
                }
            } catch (err) {
                callbackSetList([
                    { 
                        title: '连接失败', 
                        description: `无法连接到 ${apiBase}: ${err.message}。请检查地址或确认服务器已启动。` 
                    },
                    {
                        title: '如何部署本地服务器？',
                        description: '点击打开官网文档查看部署指南',
                        isCommandContext: true,
                        commandTrigger: 'libre',
                        action: 'open_docs'
                    }
                ]);
                return { disableClear: true };
            }
        }

        return {};
    }
};
