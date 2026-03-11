module.exports = {
    trigger: 'ollama',
    title: 'Ollama 配置',
    description: '设置 Ollama 大语言模型 API 和系统提示词 (/ollama)',

    handleSearch(subInput, callbackSetList, appConfig) {
        const ollamaConfig = appConfig.ollama || {};
        let statusText = '未配置完全';
        
        if (ollamaConfig.apiBase && ollamaConfig.model) {
            statusText = `模型: ${ollamaConfig.model}`;
        }

        callbackSetList([
            {
                title: '打开 Ollama 设置面板',
                description: `当前状态: ${statusText}。点击此项或回车键打开可视化配置面板。`,
                isCommandContext: true,
                commandTrigger: 'ollama',
                actionType: 'open_panel'
            }
        ]);
    },

    handleSelect(itemData, appConfig, callbackSetList) {
        if (!itemData.isCommandContext) return {};

        if (itemData.actionType === 'open_panel') {
            // 返回特定的信号，让 preload.js 捕获并打开 iframe
            return {
                openOllamaConfigPanel: true,
                disableClear: true // 保持搜索框以便恢复
            };
        }

        return {};
    }
};
