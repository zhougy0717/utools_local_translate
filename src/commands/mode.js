const offlineDictHandler = require('./modes/offline_dict');
const ollamaHandler = require('./modes/ollama');
const libreTranslateHandler = require('./modes/libretranslate');

// 策略映射表
const handlerMap = {
    [offlineDictHandler.id]: offlineDictHandler,
    [ollamaHandler.id]: ollamaHandler,
    [libreTranslateHandler.id]: libreTranslateHandler
};

const handlers = Object.values(handlerMap);

module.exports = {
    trigger: 'mode',
    title: '选择翻译模式',
    description: '切换翻译使用的模型或离线词典 (/mode)',

    handleSearch(subInput, callbackSetList, appConfig) {
        // 构建一级模式列表
        const items = handlers.map(handler => handler.getSearchItemData(appConfig));

        // 基于子输入进行简单筛选
        const fuzzyInput = subInput.trim().toLowerCase();
        const filteredItems = items.filter(item =>
            item.title.toLowerCase().includes(fuzzyInput) ||
            item.description.toLowerCase().includes(fuzzyInput)
        );

        callbackSetList(filteredItems);
    },

    handleSelect(itemData, appConfig, callbackSetList) {
        const handler = handlerMap[itemData.modeId];
        if (handler) {
            // 1. 将业务逻辑委托给具体的 Handler
            const signal = handler.handleSelect(itemData, appConfig, callbackSetList);

            // 2. 中央持久化收尾：如果不是仅为了展开二级菜单（disableClear），则统一存盘
            if (typeof utools !== 'undefined' && signal && !signal.disableClear) {
                utools.dbStorage.setItem('app_config', appConfig);
            }

            return signal;
        }

        return {};
    }
};
