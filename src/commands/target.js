const Icons = require('./icons');

class TargetLanguageCommand {
    constructor() {
        this.trigger = 'target';
        this.title = '设置目标语言';
        this.description = '指定全局翻译的目标语种';
        this.icon = Icons.LANG;
    }

    handleSearch(subInput, callbackSetList, appConfig) {
        // Step 2.1: 暂时返回空列表
        callbackSetList([]);
    }

    handleSelect(itemData, appConfig) {
        // Step 2.1: 暂无逻辑
        return {};
    }
}

module.exports = new TargetLanguageCommand();
