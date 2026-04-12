const Icons = require('./icons');
const SUPPORTED_LANGUAGES = require('./languages');

class TargetLanguageCommand {
    constructor() {
        this.trigger = 'target';
        this.title = '设置目标语言';
        this.description = '指定全局翻译的目标语种';
        this.icon = Icons.LANG;
    }

    handleSearch(subInput, callbackSetList, appConfig) {
        const currentTarget = appConfig.getTranslationTarget();
        const fuzzyInput = (subInput || '').trim().toLowerCase();

        const items = SUPPORTED_LANGUAGES
            .filter(lang => 
                lang.name.toLowerCase().includes(fuzzyInput) || 
                lang.code.toLowerCase().includes(fuzzyInput)
            )
            .map(lang => {
                const isActive = lang.code === currentTarget;
                const activeSuffix = isActive ? ' (🌟 当前设为目标)' : '';
                
                return {
                    title: `${lang.name}${activeSuffix}`,
                    description: lang.desc,
                    isCommandContext: true,
                    commandTrigger: this.trigger,
                    modeId: 'target',
                    langCode: lang.code,
                    icon: this.icon
                };
            });

        callbackSetList(items);
    }

    handleSelect(itemData, appConfig) {
        if (!itemData.langCode) return {};

        // 更新持久化配置
        appConfig.setTranslationTarget(itemData.langCode);

        // 发送通知提示用户
        if (typeof utools !== 'undefined') {
            const langName = SUPPORTED_LANGUAGES.find(l => l.code === itemData.langCode)?.name || itemData.langCode;
            utools.showNotification(`设置成功：目标语言已切换至 ${langName}`);
        }

        // 返回副作用指令：恢复搜索流
        return {
            restoreSearch: true
        };
    }
}

module.exports = new TargetLanguageCommand();
