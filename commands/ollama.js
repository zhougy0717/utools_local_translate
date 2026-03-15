const { OllamaConfig, OLLAMA_DEFAULTS } = require('../backends/ollama/config');

// 获取 Ollama 配置（从独立存储键 backend_ollama）
function getOllamaConfig() {
    const configManager = new OllamaConfig();
    return configManager.load();
}

// 保存 Ollama 配置
function saveOllamaConfig(config) {
    const configManager = new OllamaConfig();
    configManager.save(config);
}

module.exports = {
    trigger: 'ollama',
    title: 'Ollama 配置',
    description: '设置 Ollama API 地址、密钥和模型 (/ollama <url> [key])',

    // 解析输入并显示列表
    handleSearch(subInput, callbackSetList, appConfig) {
        const input = subInput.trim();
        const parts = input.split(/\s+/);
        const inputApiBase = parts[0] || '';
        const inputApiKey = parts[1] || '';

        const items = [
            {
                title: '访问 Ollama 官网',
                description: '查看如何下载和使用 Ollama (https://ollama.com/)',
                isCommandContext: true,
                commandTrigger: 'ollama',
                action: 'open_docs'
            }
        ];

        // 从 backend_ollama 存储键读取配置
        const ollamaConfig = getOllamaConfig();
        const currentApiBase = ollamaConfig.apiBase || OLLAMA_DEFAULTS.apiBase;
        const currentApiKey = ollamaConfig.apiKey || OLLAMA_DEFAULTS.apiKey;
        const currentModel = ollamaConfig.model;

        // 无输入时显示当前配置状态和选项
        if (!input && currentApiBase) {
            const itemsToShow = [];

            // 添加服务器状态项
            const serverItem = {
                title: `当前服务器: ${currentApiBase}`,
                description: currentApiKey ? `API Key: ${currentApiKey}` : '不使用 API Key',
                isCommandContext: true,
                commandTrigger: 'ollama',
                action: 'test_connection',
                apiBase: currentApiBase,
                apiKey: currentApiKey
            };
            itemsToShow.push(serverItem);

            // 添加模型选项（如果有）
            const modelItem = {
                title: currentModel ? `当前模型: ${currentModel}` : '未选择模型',
                description: currentModel ? '点击重新选择模型' : '点击选择模型',
                isCommandContext: true,
                commandTrigger: 'ollama',
                action: 'select_model_direct',
                apiBase: currentApiBase,
                apiKey: currentApiKey,
                model: currentModel
            };
            itemsToShow.push(modelItem);

            // 添加 Prompt 配置项
            const currentPrompt = ollamaConfig.prompt || '';
            const promptItem = {
                title: '配置系统提示词 (Prompt)',
                description: currentPrompt ? currentPrompt : '点击设置翻译提示词',
                isCommandContext: true,
                commandTrigger: 'ollama',
                action: 'configure_prompt',
                apiBase: currentApiBase,
                apiKey: currentApiKey,
                model: currentModel
            };
            itemsToShow.push(promptItem);

            // 添加访问官网选项（放在最后）
            itemsToShow.push({
                title: '访问 Ollama 官网',
                description: '查看如何下载和使用 Ollama (https://ollama.com/)',
                isCommandContext: true,
                commandTrigger: 'ollama',
                action: 'open_docs'
            });

            // 引导列表渲染预览
            callbackSetList(itemsToShow);

            // 异步检测服务器连通性
            this._checkConnection(currentApiBase, currentApiKey)
                .then(connected => {
                    const updatedItems = itemsToShow.map(it => {
                        if (it.action === 'test_connection') {
                            return {
                                ...it,
                                title: connected ? `🟢 服务器: ${currentApiBase}` : `❌ 服务器: ${currentApiBase}`,
                                description: connected 
                                    ? (currentApiKey ? `API Key: ${currentApiKey} - 连接正常` : '不使用 API Key - 连接正常')
                                    : (currentApiKey ? `API Key: ${currentApiKey} - 无法连接` : '不使用 API Key - 无法连接')
                            };
                        }
                        return it;
                    });
                    callbackSetList(updatedItems);
                })
                .catch(err => {
                    const updatedItems = itemsToShow.map(it => {
                        if (it.action === 'test_connection') {
                            return {
                                ...it,
                                title: `❌ 服务器: ${currentApiBase}`,
                                description: `连接错误: ${err.message}`
                            };
                        }
                        return it;
                    });
                    callbackSetList(updatedItems);
                });
            return;
        }

        // 有输入时显示保存选项
        if (inputApiBase) {
            items.unshift({
                title: `保存并检测: ${inputApiBase}`,
                description: inputApiKey ? `使用 API Key: ${inputApiKey}` : '不使用 API Key',
                isCommandContext: true,
                commandTrigger: 'ollama',
                action: 'save_and_test',
                apiBase: inputApiBase,
                apiKey: inputApiKey
            });
        } else {
            items.unshift({
                title: '请输入 Ollama API 地址',
                description: '例如: http://127.0.0.1:11434/v1',
                isCommandContext: true,
                commandTrigger: 'ollama',
                action: 'none'
            });
        }

        callbackSetList(items);
    },

    // 处理列表项选择
    async handleSelect(itemData, appConfig, callbackSetList) {
        console.log('[Ollama] handleSelect called:', itemData);
        if (!itemData.isCommandContext) return {};

        if (itemData.action === 'open_docs') {
            if (typeof utools !== 'undefined') {
                utools.shellOpenExternal('https://ollama.com/');
            }
            return { restoreSearch: true };
        }

        if (itemData.action === 'test_connection') {
            // 测试现有服务器连接
            const { apiBase, apiKey } = itemData;

            callbackSetList([{
                title: '正在检测服务器连通性...',
                description: apiBase
            }]);

            try {
                const connected = await this._checkConnection(apiBase, apiKey);

                if (!connected) {
                    throw new Error('无法连接到 Ollama 服务器');
                }

                callbackSetList([{
                    title: '🟢 连接成功',
                    description: '服务器连接正常'
                }]);

                // 短暂显示后返回
                await new Promise(resolve => setTimeout(resolve, 1500));
                return { restoreSearch: true };
            } catch (err) {
                callbackSetList([
                    {
                        title: '连接失败',
                        description: `${err.message}。请检查地址或确认 Ollama 已启动。`
                    },
                    {
                        title: '如何部署 Ollama？',
                        description: '点击打开官网查看部署指南',
                        isCommandContext: true,
                        commandTrigger: 'ollama',
                        action: 'open_docs'
                    }
                ]);
                return { disableClear: true };
            }
        }

        if (itemData.action === 'save_and_test') {
            const { apiBase, apiKey } = itemData;

            // 提示检测中
            callbackSetList([{ title: '正在检测服务器连通性...', description: apiBase }]);

            try {
                // 检测连接
                const connected = await this._checkConnection(apiBase, apiKey);

                if (!connected) {
                    throw new Error('无法连接到 Ollama 服务器');
                }

                // 连接成功，获取模型列表
                callbackSetList([{
                    title: '🟢 连接成功',
                    description: '正在加载模型列表...'
                }]);

                const models = await this._fetchModels(apiBase, apiKey);

                if (models.length > 0) {
                    // 获取当前模型配置用于标记
                    const currentOllamaConfig = getOllamaConfig();
                    // 显示模型选择列表
                    const modelItems = models.map(model => ({
                        title: model.name,
                        description: model.name === currentOllamaConfig.model ? '✓ 当前使用' : '点击选择',
                        isCommandContext: true,
                        commandTrigger: 'ollama',
                        action: 'select_model',
                        apiBase: apiBase,
                        apiKey: apiKey,
                        model: model.name
                    }));

                    callbackSetList(modelItems);
                    return { disableClear: true };
                } else {
                    // 无可用模型
                    callbackSetList([
                        {
                            title: '⚠️ 连接成功但无可用模型',
                            description: '请确保 Ollama 中已下载模型'
                        },
                        {
                            title: '打开 Ollama 官网下载模型',
                            description: 'https://ollama.com/',
                            isCommandContext: true,
                            commandTrigger: 'ollama',
                            action: 'open_docs'
                        }
                    ]);
                    return { disableClear: true };
                }
            } catch (err) {
                callbackSetList([
                    {
                        title: '连接失败',
                        description: `${err.message}。请检查地址或确认 Ollama 已启动。`
                    },
                    {
                        title: '如何部署 Ollama？',
                        description: '点击打开官网查看部署指南',
                        isCommandContext: true,
                        commandTrigger: 'ollama',
                        action: 'open_docs'
                    }
                ]);
                return { disableClear: true };
            }
        }

        if (itemData.action === 'select_model_direct') {
            // 从现有配置直接重新选择模型
            const { apiBase, apiKey } = itemData;
            const ollamaConfig = getOllamaConfig();
            const currentModel = itemData.model || ollamaConfig.model;

            callbackSetList([{
                title: '正在检测服务器连通性...',
                description: apiBase
            }]);

            try {
                // 检测连接
                const connected = await this._checkConnection(apiBase, apiKey);

                if (!connected) {
                    throw new Error('无法连接到 Ollama 服务器');
                }

                // 连接成功，获取模型列表
                callbackSetList([{
                    title: '🟢 连接成功',
                    description: '正在加载模型列表...'
                }]);

                const models = await this._fetchModels(apiBase, apiKey);

                if (models.length > 0) {
                    // 显示模型选择列表
                    const modelItems = models.map(model => ({
                        title: model.name,
                        description: model.name === currentModel ? '✓ 当前使用' : '点击选择',
                        isCommandContext: true,
                        commandTrigger: 'ollama',
                        action: 'select_model',
                        apiBase: apiBase,
                        apiKey: apiKey,
                        model: model.name
                    }));

                    callbackSetList(modelItems);
                    return { disableClear: true };
                } else {
                    // 无可用模型
                    callbackSetList([
                        {
                            title: '⚠️ 连接成功但无可用模型',
                            description: '请确保 Ollama 中已下载模型'
                        },
                        {
                            title: '打开 Ollama 官网下载模型',
                            description: 'https://ollama.com/',
                            isCommandContext: true,
                            commandTrigger: 'ollama',
                            action: 'open_docs'
                        }
                    ]);
                    return { disableClear: true };
                }
            } catch (err) {
                callbackSetList([
                    {
                        title: '连接失败',
                        description: `${err.message}。请检查服务器状态。`
                    },
                    {
                        title: '重新配置服务器',
                        description: '点击返回服务器配置',
                        isCommandContext: true,
                        commandTrigger: 'ollama',
                        action: 'back_to_server'
                    }
                ]);
                return { disableClear: true };
            }
        }

        if (itemData.action === 'select_model') {
            console.log('[Ollama] select_model action triggered');
            const { apiBase, apiKey, model } = itemData;
            console.log('[Ollama] Selected model:', model, 'apiBase:', apiBase);

            // 保存到 backend_ollama 存储键
            const ollamaConfig = getOllamaConfig();
            ollamaConfig.apiBase = apiBase;
            ollamaConfig.apiKey = apiKey;
            ollamaConfig.model = model;
            saveOllamaConfig(ollamaConfig);
            console.log('[Ollama] Config saved');

            // 启用 Ollama 后端
            if (!appConfig.backends) {
                appConfig.backends = {};
            }
            appConfig.backends.ollama = true;
            appConfig.backends.libretranslate = false;
            appConfig.backends.offline_dict = false;

            // 保存应用配置
            if (typeof utools !== 'undefined') {
                utools.dbStorage.setItem('app_config', appConfig);
                utools.showNotification(`Ollama 配置成功，当前模型: ${model}`);
            }

            callbackSetList([{
                title: '✅ 配置已保存',
                description: `模型 ${model} 已选中并启用`
            }]);

            await new Promise(resolve => setTimeout(resolve, 1000));

            console.log('[Ollama] Returning reloadBackend and restoreSearch signals');
            return {
                reloadBackend: true,
                restoreSearch: true
            };
        }

        if (itemData.action === 'back_to_server') {
            // 返回服务器配置页面
            return { restoreSearch: true };
        }

        if (itemData.action === 'configure_prompt') {
            // 直接打开 Ollama 配置界面
            return { openOllamaConfigPanel: true };
        }

        if (itemData.action === 'none') {
            // 无操作，保持当前状态
            return {};
        }

        return {};
    },

    // 辅助方法：检测服务器连通性
    async _checkConnection(apiBase, apiKey) {
        const baseUrl = this._getBaseUrl(apiBase);
        const endpoint = `${baseUrl}/api/tags`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        try {
            const response = await fetch(endpoint, {
                method: 'GET',
                signal: controller.signal,
                headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}
            });
            clearTimeout(timeoutId);
            return response.ok;
        } catch (err) {
            clearTimeout(timeoutId);
            return false;
        }
    },

    // 辅助方法：获取模型列表
    async _fetchModels(apiBase, apiKey) {
        const baseUrl = this._getBaseUrl(apiBase);
        const endpoint = `${baseUrl}/api/tags`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        try {
            const response = await fetch(endpoint, {
                method: 'GET',
                signal: controller.signal,
                headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            return data.models || [];
        } catch (err) {
            clearTimeout(timeoutId);
            throw new Error(`获取模型列表失败: ${err.message}`);
        }
    },

    // 辅助方法：获取基础 URL（去除 /v1 后缀）
    _getBaseUrl(apiBase) {
        let baseUrl = apiBase;
        if (baseUrl.endsWith('/v1')) {
            baseUrl = baseUrl.substring(0, baseUrl.length - 3);
        }
        return baseUrl.replace(/\/+$/, '');
    }
};