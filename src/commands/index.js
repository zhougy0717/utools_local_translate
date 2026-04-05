const modeCommand = require('./mode.js');
const libreCommand = require('./libre.js');

// 注册激活的所有命令
const COMMANDS = [
    modeCommand,
    libreCommand
];

const Icons = require('./icons.js');

function toBoldUnicode(str) {
    return str.split('').map(char => {
        const code = char.charCodeAt(0);
        if (code >= 65 && code <= 90) return String.fromCodePoint(0x1D400 + code - 65); // A-Z
        if (code >= 97 && code <= 122) return String.fromCodePoint(0x1D41A + code - 97); // a-z
        if (code >= 48 && code <= 57) return String.fromCodePoint(0x1D7CE + code - 48); // 0-9
        return char;
    }).join('');
}

const CommandManager = {
    handleSearch(searchWord, callbackSetList, appConfig) {
        const parts = searchWord.split(/\s+/);
        const cmdToken = parts[0].toLowerCase();

        // 1. 匹配具体的命令子集 (如完全命中了 '/mode' 模式)
        for (const cmd of COMMANDS) {
            const targetToken = `/${cmd.trigger.toLowerCase()}`;
            if (cmdToken === targetToken) {
                const subInput = searchWord.slice(targetToken.length).trim();
                return cmd.handleSearch(subInput, callbackSetList, appConfig); // 交给具体命令接管渲染
            }
        }

        // 2. 处于根级斜线页面，或部分匹配，模糊展示命令列表
        const inputCmd = cmdToken.slice(1).trim();
        const matchedCommands = COMMANDS.filter(cmd => cmd.trigger.startsWith(inputCmd));

        if (matchedCommands.length > 0) {
            const listItems = matchedCommands.map(cmd => {
                let icon = Icons.MODE;
                if (cmd.trigger === 'libre') icon = Icons.LIBRE;
                
                const boldTrigger = toBoldUnicode(`/${cmd.trigger}`);
                
                return {
                    title: `[${boldTrigger}]  ${cmd.title}`,
                    description: cmd.description.replace(/\s*\(\/.*\)$/, ''),
                    isCommandContext: true,
                    trigger: cmd.trigger,
                    isRootCommand: true,
                    icon: icon
                };
            });
            callbackSetList(listItems);
        } else {
            callbackSetList([
                { title: '未找到匹配的命令', description: searchWord, icon: Icons.WARNING }
            ]);
        }
    },

    handleSelect(itemData, appConfig, callbackSetList) {
        if (!itemData.isCommandContext) return {};

        // 处理一级列表的点击事件，主动帮用户补全文字
        if (itemData.isRootCommand) {
            return { autoComplete: `/${itemData.trigger} ` };
        }

        // 将具体的二级菜单选中转发给特定的命令模块处理
        const trigger = itemData.commandTrigger;
        const cmd = COMMANDS.find(c => c.trigger === trigger);
        if (cmd) {
            return cmd.handleSelect(itemData, appConfig, callbackSetList);
        }

        return {};
    }
};

module.exports = CommandManager;
