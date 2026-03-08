const modeCommand = require('./mode.js');
const modelCommand = require('./model.js');
const pathCommand = require('./path.js');

// 注册激活的所有命令
const COMMANDS = [
    modeCommand,
    modelCommand,
    pathCommand
];

const CommandManager = {
    handleSearch(searchWord, callbackSetList) {
        const parts = searchWord.split(/\s+/);
        const cmdToken = parts[0].toLowerCase();

        // 1. 匹配具体的命令子集 (如完全命中了 '/mode' 模式)
        for (const cmd of COMMANDS) {
            const targetToken = `/${cmd.trigger.toLowerCase()}`;
            if (cmdToken === targetToken) {
                const subInput = searchWord.slice(targetToken.length).trim();
                return cmd.handleSearch(subInput, callbackSetList); // 交给具体命令接管渲染
            }
        }

        // 2. 处于根级斜线页面，或部分匹配，模糊展示命令列表
        const inputCmd = cmdToken.slice(1).trim();
        const matchedCommands = COMMANDS.filter(cmd => cmd.trigger.startsWith(inputCmd));

        if (matchedCommands.length > 0) {
            const listItems = matchedCommands.map(cmd => ({
                title: cmd.title,
                description: cmd.description,
                isCommandContext: true,
                trigger: cmd.trigger,
                isRootCommand: true
            }));
            callbackSetList(listItems);
        } else {
            callbackSetList([
                { title: '未找到匹配的命令', description: searchWord }
            ]);
        }
    },

    handleSelect(itemData, appConfig) {
        if (!itemData.isCommandContext) return {};

        // 处理一级列表的点击事件，主动帮用户补全文字
        if (itemData.isRootCommand) {
            return { autoComplete: `/${itemData.trigger} ` };
        }

        // 将具体的二级菜单选中转发给特定的命令模块处理
        const trigger = itemData.commandTrigger;
        const cmd = COMMANDS.find(c => c.trigger === trigger);
        if (cmd) {
            return cmd.handleSelect(itemData, appConfig);
        }

        return {};
    }
};

module.exports = CommandManager;
