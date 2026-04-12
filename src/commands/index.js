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

const CommandManager = {
    handleSearch(searchWord, callbackSetList, appConfig) {
        try {
            const input = (searchWord || '').toLowerCase().trim();
            if (!input) {
                callbackSetList([]);
                return;
            }

            // 1. 精确前缀匹配路由逻辑：检测是否已完整进入某个指令（如 "/mode"）
            for (const cmd of COMMANDS) {
                const prefix = `/${cmd.trigger}`;
                if (input === prefix || input.startsWith(prefix + ' ')) {
                    const subInput = searchWord.slice(prefix.length).trim();
                    return cmd.handleSearch(subInput, callbackSetList, appConfig);
                }
            }

            // 2. 根级模糊搜索逻辑：根据当前输入过滤命令列表
            // 提取核心关键词（去掉前导斜杠）
            const keyword = input.startsWith('/') ? input.slice(1) : input;

            const matched = COMMANDS.filter(cmd => {
                // 只要触发词包含关键词，或者标题包含关键词
                return cmd.trigger.indexOf(keyword) !== -1 || 
                       cmd.title.toLowerCase().indexOf(keyword) !== -1;
            });

            if (matched.length > 0) {
                const listItems = matched.map(cmd => {
                    const icon = cmd.trigger === 'libre' ? Icons.LIBRE : 
                               cmd.trigger === 'target' ? Icons.LANG : Icons.MODE;
                    return {
                        title: `/${cmd.trigger} ${cmd.title}`,
                        description: cmd.description,
                        isCommandContext: true,
                        trigger: cmd.trigger,
                        isRootCommand: true,
                        icon: icon
                    };
                });
                callbackSetList(listItems);
            } else {
                callbackSetList([
                    { title: '未找到匹配命令', description: '支持 /mode, /help, /target' }
                ]);
            }
        } catch (e) {
            console.error('[CommandManager] handleSearch error:', e);
            callbackSetList([{ title: '命令引擎异常', description: e.message }]);
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
