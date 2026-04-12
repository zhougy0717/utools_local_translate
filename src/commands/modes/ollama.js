const { OllamaConfig } = require('../../backends/ollama/config');
const { STATUS } = require('./constants');
const Icons = require('../icons');
const { setActiveMode } = require('../../utils/mode_helper');

class OllamaHandler {
    constructor() {
        this.id = 'ollama';
        this.title = 'Ollama (LLM)';
        this.description = '使用 Ollama 或是兼容 OpenAI 格式的 API 进行翻译 (可定制 Prompt)';
        this.icon = Icons.OLLAMA;

        this.actions = {
            'confirm_ollama': (appConfig) => {
                setActiveMode(appConfig, 'ollama');
                return { reloadBackend: true, restoreSearch: true };
            },
            'open_ollama_config': (appConfig) => {
                setActiveMode(appConfig, 'ollama');
                return { openConfigPanel: true, reloadBackend: true };
            }
        };
    }

    _getStatus(_appConfig) {
        const configManager = new OllamaConfig();
        const config = configManager.load();
        if (config.apiBase && config.model) {
            return { status: STATUS.READY, config };
        }
        return { status: STATUS.UNAVAILABLE, config };
    }

    getSearchItemData(appConfig) {
        const { status, config } = this._getStatus(appConfig);
        let statusText = '未知状态';
        let statusPrefix = '⚠️';

        if (status === STATUS.READY) {
            statusText = `模型: ${config.model}`;
            statusPrefix = '✅';
        } else {
            statusText = '未配置 API 地址或模型';
        }

        const isActive = !!(appConfig.backends && appConfig.backends.ollama);
        const activeSuffix = isActive ? ' (已激活 🌟)' : '';

        return {
            title: `${this.title}${activeSuffix}`,
            description: `${statusPrefix} ${statusText} — ${this.description}`,
            isCommandContext: true,
            commandTrigger: 'mode',
            modeId: this.id,
            icon: this.icon
        };
    }

    handleSelect(itemData, appConfig, callbackSetList) {
        if (!itemData.action) {
            const { config } = this._getStatus(appConfig);
            const modelName = config.model || '未选择模型';
            const apiBase = config.apiBase || '未配置地址';

            callbackSetList([
                {
                    title: '确认启用 Ollama 翻译模式',
                    description: `当前配置: ${modelName} @ ${apiBase}`,
                    isCommandContext: true,
                    commandTrigger: 'mode',
                    modeId: this.id,
                    action: 'confirm_ollama',
                    icon: Icons.OLLAMA
                },
                {
                    title: '打开 Ollama 配置面板',
                    description: `⚙️ 设置 API 地址、模型名称与自定义 Prompt`,
                    isCommandContext: true,
                    commandTrigger: 'mode',
                    modeId: this.id,
                    action: 'open_ollama_config',
                    icon: Icons.OLLAMA
                }
            ]);
            return { disableClear: true };
        }

        // 2. 执行具体的 Action
        const actionFn = this.actions[itemData.action];
        if (actionFn) {
            return actionFn(appConfig, itemData, callbackSetList);
        }

        // 3. Fallback (仅在没有特定 Action 或为默认行为时触发)
        const { status } = this._getStatus(appConfig);
        if (status !== STATUS.READY) {
            setActiveMode(appConfig, this.id);
            return { openConfigPanel: true, reloadBackend: true };
        }

        return {};
    }
}

module.exports = new OllamaHandler();
