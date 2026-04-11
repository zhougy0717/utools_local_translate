const Icons = require('./icons.js');

module.exports = {
    trigger: 'help',
    title: '帮助与说明',
    description: '查看进阶使用技巧与支持说明 (/help)',

    handleSearch(subInput, callbackSetList, appConfig) {
        callbackSetList([
            {
                title: '打开使用指南与快捷键说明',
                description: '前往在线文档了解更高效的查词技巧',
                isCommandContext: true,
                commandTrigger: 'help',
                action: 'open_docs',
                icon: Icons.DICT
            },
            {
                title: '提交问题或建议',
                description: '在 GitHub 仓库或反馈区报告您的使用体验',
                isCommandContext: true,
                commandTrigger: 'help',
                action: 'open_issues',
                icon: Icons.READY
            }
        ]);
    },

    handleSelect(itemData, appConfig, callbackSetList) {
        if (!itemData.action) {
            // Confirm mode menu structure
            return { disableClear: true };
        }

        if (itemData.action === 'open_docs') {
            if (typeof utools !== 'undefined') {
                utools.shellOpenExternal('https://github.com'); // TODO: Replace with real URL later if available
            }
            return { restoreSearch: true };
        }

        if (itemData.action === 'open_issues') {
            if (typeof utools !== 'undefined') {
                utools.shellOpenExternal('https://github.com'); // TODO: Replace with real URL later if available
            }
            return { restoreSearch: true };
        }

        return {};
    }
};
