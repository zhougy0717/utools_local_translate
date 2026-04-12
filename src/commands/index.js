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
    activeCommand: null, // 存储当前活跃的命令上下文

    hasContext() {
        return this.activeCommand !== null;
    },

    clearContext() {
        this.activeCommand = null;
    },

    handleSearch(searchWord, callbackSetList, appConfig) {
        try {
            const input = (searchWord || '').toLowerCase().trim();
            
            // 1. 粘性逻辑：如果输入为空且有上下文，依然交给上下文处理器（用于展示全量列表和返回项）
            if (!input && this.activeCommand) {
                return this.activeCommand.handleSearch('', callbackSetList, appConfig);
            }

            if (!input) {
                this.activeCommand = null;
                callbackSetList([]);
                return;
            }

            // 2. 优先级 A：显式前缀路由逻辑（检测是否已完整进入某个指令）
            for (const cmd of COMMANDS) {
                const prefix = `/${cmd.trigger}`;
                if (input === prefix || input.startsWith(prefix + ' ')) {
                    this.activeCommand = cmd; // 锁定/更新当前指令上下文
                    const subInput = searchWord.slice(prefix.length).trim();
                    return cmd.handleSearch(subInput, callbackSetList, appConfig);
                }
            }

            // 3. 优先级 B：隐式上下文透传（锁定模式下，将输入视为子过滤）
            if (this.activeCommand) {
                // 情况 1: 输入为空、空格或仅为 "/" (点击一级菜单后的常见状态)
                if (!input || input === '/') {
                    return this.activeCommand.handleSearch('', callbackSetList, appConfig);
                }

                // 情况 2: 不以 / 开头，直接透传 (例如 "chi")
                if (!input.startsWith('/')) {
                    return this.activeCommand.handleSearch(searchWord, callbackSetList, appConfig);
                }
                
                // 情况 3: 以 / 开头，且包含空格 (例如 "/ta chi" 或 "/t chi")
                const spaceIdx = searchWord.indexOf(' ');
                if (spaceIdx !== -1) {
                    const prefixPart = searchWord.slice(0, spaceIdx).toLowerCase().trim();
                    const matchesOther = COMMANDS.some(cmd => `/${cmd.trigger}` === prefixPart && cmd !== this.activeCommand);
                    if (!matchesOther) {
                        const subInput = searchWord.slice(spaceIdx + 1).trim();
                        return this.activeCommand.handleSearch(subInput, callbackSetList, appConfig);
                    }
                } else {
                    // 情况 4: 以 / 开头但无空格 (例如 "/ta" 或 "/chi")
                    const currentTriggerPrefix = `/${this.activeCommand.trigger}`;
                    // 如果它是当前指令的子集 (如 /t, /ta)，则透传空内容 (展示全量)
                    if (currentTriggerPrefix.startsWith(input)) {
                        return this.activeCommand.handleSearch('', callbackSetList, appConfig);
                    }
                    // 如果它不是当前指令的子集，且没匹配到其他指令全名，则把斜杠后的内容视为过滤词 (如 /chi -> chi)
                    const matchesOther = COMMANDS.some(cmd => `/${cmd.trigger}` === input && cmd !== this.activeCommand);
                    if (!matchesOther) {
                        return this.activeCommand.handleSearch(input.slice(1), callbackSetList, appConfig);
                    }
                }
            }

            // 4. 优先级 C：根级模糊搜索逻辑（原有逻辑：根据当前输入过滤命令列表）
            const keyword = input.startsWith('/') ? input.slice(1) : input;

            // 如果当前已经在某个模式下且用户还在输入斜杠命令，通常意味着想切换，清除旧状态
            if (input.startsWith('/')) {
                this.activeCommand = null;
            }

            const matched = COMMANDS.filter(cmd => {
                return cmd.trigger.indexOf(keyword) !== -1 || 
                       cmd.title.toLowerCase().indexOf(keyword) !== -1;
            });

            if (matched.length > 0) {
                const listItems = matched.map(cmd => {
                    const icon = cmd.trigger === 'target' ? Icons.LANG : 
                               cmd.trigger === 'help' ? Icons.HELP : Icons.MODE;
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

        // 核心改动：点击一级列表时，锁定上下文并刷新渲染二级菜单
        if (itemData.isRootCommand) {
            const targetCmd = COMMANDS.find(c => c.trigger === itemData.trigger);
            if (targetCmd) {
                this.activeCommand = targetCmd; // 锁定模式
                targetCmd.handleSearch('', callbackSetList, appConfig);
            }
            return {};
        }

        // 处理“返回查词”特殊条目
        if (itemData.isReturnToMain) {
            this.activeCommand = null;
            // 触发一次空搜索，这在 preload.js 中会被拦截并恢复翻译视图
            return {
                restoreSearch: true
            };
        }

        // 将具体的二级菜单选中转发给特定的命令模块处理
        const trigger = itemData.commandTrigger;
        const cmd = COMMANDS.find(c => c.trigger === trigger);
        if (cmd) {
            // 选中二级菜单后，默认认为操作完成，清除上下文（除非具体指令要求保留）
            const result = cmd.handleSelect(itemData, appConfig, callbackSetList);
            if (result && !result.disableClearContext) {
                this.activeCommand = null;
            }
            return result;
        }

        return {};
    }
};

module.exports = CommandManager;
