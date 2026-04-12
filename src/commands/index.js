const modeCommand = require('./mode.js');
const helpCommand = require('./help.js');
const targetCommand = require('./target.js');

// 注册激活的所有命令
const COMMANDS = [
    modeCommand,
    helpCommand,
    targetCommand
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
        const input = searchWord.toLowerCase();

        // 1. 精确匹配指令路由 (如完全命中了 '/mode' 或以 '/mode ' 开头)
        for (const cmd of COMMANDS) {
            const prefix = `/${cmd.trigger.toLowerCase()}`;
            if (input === prefix || input.startsWith(prefix + ' ')) {
                const subInput = searchWord.slice(prefix.length).trim();
                return cmd.handleSearch(subInput, callbackSetList, appConfig);
            }
        }

        // 2. 处于根级斜线页面，模糊匹配匹配命令列表 (如针对 '/')
        const inputToken = searchWord.trim().toLowerCase();
        const inputCmd = inputToken.startsWith('/') ? inputToken.slice(1) : '';
        const matchedCommands = COMMANDS.filter(cmd => cmd.trigger.startsWith(inputCmd));

        if (matchedCommands.length > 0) {
            const listItems = matchedCommands.map(cmd => {
                const icon = cmd.trigger === 'libre' ? Icons.LIBRE : 
                           cmd.trigger === 'target' ? Icons.LANG : Icons.MODE;
                
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

        // 核心改动：点击一级列表时不补全输入框内容，而是直接通过回调刷新列表项
        if (itemData.isRootCommand) {
            const targetCmd = COMMANDS.find(c => c.trigger === itemData.trigger);
            if (targetCmd) {
                // 主动触发搜索逻辑，并直接利用 callbackSetList 渲染出二级菜单
                targetCmd.handleSearch('', callbackSetList, appConfig);
            }
            // 返回空信号，不让 uTools 更改输入框内容
            return {};
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
