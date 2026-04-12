const Icons = require('./icons');

class TargetLanguageCommand {
    constructor() {
        this.trigger = 'target';
        this.title = '设置目标语言';
        this.description = '指定全局翻译的目标语种';
        this.icon = Icons.LANG;
    }

    handleSearch(subInput, callbackSetList, appConfig) {
        callbackSetList([]);
    }

    handleSelect(itemData, appConfig) {
        return {};
    }
}

module.exports = new TargetLanguageCommand();
