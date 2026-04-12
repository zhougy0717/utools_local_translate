const { LibreTranslateConfig } = require('../../backends/libretranslate/config');
const { STATUS } = require('./constants');
const Icons = require('../icons');
const { setActiveMode } = require('../../utils/mode_helper');

class LibreTranslateHandler {
    constructor() {
        this.id = 'libretranslate';
        this.title = 'LibreTranslate (OSS)';
        this.description = '使用开源的 LibreTranslate API 进行翻译 (可私有部署)';
        this.icon = Icons.LIBRE;

        this.actions = {
            'confirm_libre': (appConfig) => {
                setActiveMode(appConfig, 'libretranslate');
                return { reloadBackend: true, restoreSearch: true };
            },
            'open_libre_config': (appConfig) => {
                setActiveMode(appConfig, 'libretranslate');
                return { openConfigPanel: true, reloadBackend: true };
            },
            'open_libre_docs': () => {
                if (typeof utools !== 'undefined') {
                    utools.shellOpenExternal('https://docs.libretranslate.com/');
                }
                return { restoreSearch: true };
            }
        };
    }

    _getStatus(_appConfig) {
        const configManager = new LibreTranslateConfig();
        const config = configManager.load();
        if (config.apiBase) {
            return { status: STATUS.READY, config };
        }
        return { status: STATUS.UNAVAILABLE, config };
    }

    getSearchItemData(appConfig) {
        const { status, config } = this._getStatus(appConfig);
        let statusText = '未知状态';
        let statusPrefix = '⚠️';

        if (status === STATUS.READY) {
            statusText = 'API 已就绪';
            statusPrefix = '✅';
        } else {
            statusText = '未配置服务地址';
        }

        const isActive = !!(appConfig.backends && appConfig.backends.libretranslate);
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
            const apiBase = config.apiBase || '未配置地址';

            callbackSetList([
                {
                    title: '确认启用 LibreTranslate 翻译模式',
                    description: `当前服务: ${apiBase}`,
                    isCommandContext: true,
                    commandTrigger: 'mode',
                    modeId: this.id,
                    action: 'confirm_libre',
                    icon: Icons.LIBRE
                },
                {
                    title: '打开 LibreTranslate 配置面板',
                    description: `⚙️ 可视化设置服务器、Key 与语言偏好`,
                    isCommandContext: true,
                    commandTrigger: 'mode',
                    modeId: this.id,
                    action: 'open_libre_config',
                    icon: Icons.LIBRE
                },
                {
                    title: '查看 LibreTranslate 技术文档',
                    description: `🌐 了解如何私有部署或使用公开 API`,
                    isCommandContext: true,
                    commandTrigger: 'mode',
                    modeId: this.id,
                    action: 'open_libre_docs',
                    icon: Icons.LIBRE
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
        if (status !== STATUS.READY && itemData.action !== 'open_libre_docs') {
            setActiveMode(appConfig, this.id);
            return { openConfigPanel: true, reloadBackend: true };
        }

        return {};
    }
}

module.exports = new LibreTranslateHandler();
