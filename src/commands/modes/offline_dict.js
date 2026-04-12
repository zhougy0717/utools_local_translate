const { getDictStatus, DICT_STATUS } = require('../../backends/dict');
const { STATUS } = require('./constants');
const Icons = require('../icons');
const { setActiveMode } = require('../../utils/mode_helper');

class OfflineDictHandler {
    constructor() {
        this.id = 'offline_dict';
        this.title = '离线词典';
        this.description = '使用 ecdict 离线词典进行快速查词 (响应快)';
        this.icon = Icons.DICT;

        // 子 Action 映射
        this.actions = {
            'confirm_dict': (appConfig) => {
                setActiveMode(appConfig, 'offline_dict');
                return { reloadBackend: true, restoreSearch: true };
            },
            'open_dict_config': (appConfig) => {
                setActiveMode(appConfig, 'offline_dict');
                return { openConfigPanel: true, reloadBackend: true };
            }
        };
    }

    getSearchItemData(appConfig) {
        const dictInfo = getDictStatus(appConfig);
        let statusText = '未知状态';
        let statusPrefix = '⚠️';
        let currentStatus = dictInfo.status;

        if (currentStatus === STATUS.READY) {
            statusText = '词库已就绪';
            statusPrefix = '✅';
        } else if (currentStatus === STATUS.DOWNLOADING) {
            statusText = '词库下载中...';
            statusPrefix = '📥';
        } else if (currentStatus === STATUS.DOWNLOADED_UNPROCESSED) {
            statusText = '词库已下载，待构建';
            statusPrefix = '📥';
        } else {
            statusText = '未配置或未下载';
        }

        const isActive = !!(appConfig.backends && appConfig.backends.offline_dict);
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
        // 1. 如果没有 action，展示二级菜单
        if (!itemData.action) {
            const liveAppConfig = (typeof utools !== 'undefined' ? utools.dbStorage.getItem('app_config') : null) || appConfig;
            const dictInfo = getDictStatus(liveAppConfig);
            const statusLabel = dictInfo.status === STATUS.READY ? '✅ 数据已就绪' : '⚠️ 数据未就绪';

            callbackSetList([
                {
                    title: '确认启用离线词典翻译模式',
                    description: `当前状态: ${statusLabel} — ECDICT 万词库，极速本地响应`,
                    isCommandContext: true,
                    commandTrigger: 'mode',
                    modeId: this.id,
                    action: 'confirm_dict',
                    icon: Icons.DICT
                },
                {
                    title: '打开离线词典配置面板',
                    description: `⚙️ 管理词典数据与下载状态`,
                    isCommandContext: true,
                    commandTrigger: 'mode',
                    modeId: this.id,
                    action: 'open_dict_config',
                    icon: Icons.DICT
                }
            ]);
            return { disableClear: true };
        }

        // 2. 执行具体的 Action
        const actionFn = this.actions[itemData.action];
        if (actionFn) {
            return actionFn(appConfig, itemData, callbackSetList);
        }

        // 3. 检查内部状态 Fallback (仅在没有特定 Action 或为默认行为时触发)
        const liveAppConfig = (typeof utools !== 'undefined' ? utools.dbStorage.getItem('app_config') : null) || appConfig;
        const dictInfo = getDictStatus(liveAppConfig);
        const status = dictInfo.status;

        if (status === STATUS.UNAVAILABLE || status === STATUS.DOWNLOADING || status === STATUS.DOWNLOADED_UNPROCESSED) {
            setActiveMode(appConfig, this.id);
            return { openConfigPanel: true, reloadBackend: true };
        }

        return {};
    }
}

module.exports = new OfflineDictHandler();
