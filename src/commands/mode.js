const fs = require('fs');
const { OllamaConfig } = require('../backends/ollama/config');
const { getDictStatus: getBackendDictStatus, downloadDicts, downloadDictsFromGitee, buildAllDicts, DICT_STATUS } = require('../backends/dict');

const MODES = [
    {
        id: 'offline_dict',
        title: '离线词典',
        description: '使用 ecdict 离线词典进行快速查词 (响应快)'
    },
    {
        id: 'ollama',
        title: 'Ollama (LLM)',
        description: '使用 Ollama 或是兼容 OpenAI 格式的 API 进行翻译 (可定制 Prompt)'
    },
    {
        id: 'libretranslate',
        title: 'LibreTranslate (OSS)',
        description: '使用开源的 LibreTranslate API 进行翻译 (可私有部署)'
    }
];

const STATUS = {
    READY: 'READY',
    UNAVAILABLE: 'UNAVAILABLE',
    DOWNLOADING: 'DOWNLOADING',
    DOWNLOADED_UNPROCESSED: 'DOWNLOADED_UNPROCESSED'
};

function getDictStatus(appConfig) {
    // 使用后端模块的状态检测
    const dictStatus = getBackendDictStatus(appConfig);
    // 直接映射 DICT_STATUS 到 STATUS
    return {
        status: dictStatus.status,
        path: dictStatus.path,
        details: dictStatus.details
    };
}

function getOllamaStatus(_appConfig) {
    // 从 backend_ollama 存储键读取 Ollama 配置
    const configManager = new OllamaConfig();
    const ollamaConfig = configManager.load();
    // 基本依赖 apiBase 和 model 两个配置项
    if (ollamaConfig.apiBase && ollamaConfig.model) {
        return { status: STATUS.READY };
    }
    return { status: STATUS.UNAVAILABLE };
}

function getLibreStatus(appConfig) {
    appConfig = appConfig || {};
    const libreConfig = appConfig.libretranslate || {};
    if (libreConfig.apiBase) {
        return { status: STATUS.READY };
    }
    return { status: STATUS.UNAVAILABLE };
}


module.exports = {
    trigger: 'mode',
    title: '选择模式',
    description: '切换翻译使用的模型或离线词典 (/mode)',

    handleSearch(subInput, callbackSetList, appConfig) {
        const dictInfo = getDictStatus(appConfig);

        const items = MODES.map(mode => {
            let statusText = '';
            let currentStatus = STATUS.UNAVAILABLE;
            let extInfo = {};
            if (mode.id === 'offline_dict') {
                currentStatus = dictInfo.status;
                extInfo = dictInfo;
                if (currentStatus === STATUS.READY) {
                    statusText = '(数据已就绪)';
                } else if (currentStatus === STATUS.DOWNLOADED_UNPROCESSED) {
                    statusText = '(未解压构建，点击处理)';
                } else if (currentStatus === STATUS.DOWNLOADING) {
                    statusText = '(下载中断，点击继续)';
                } else {
                    // UNAVAILABLE 且没有配置路径
                    if (!dictInfo.path) statusText = '(未配置路径)';
                    else statusText = '(词典未下载，按回车键下载)';
                }
            } else if (mode.id === 'ollama') {
                const ollamaInfo = getOllamaStatus(appConfig);
                currentStatus = ollamaInfo.status;
                extInfo = ollamaInfo;
                if (currentStatus === STATUS.READY) statusText = '(已配置)';
                else statusText = '(未配置 API)';
            } else if (mode.id === 'libretranslate') {
                const libreInfo = getLibreStatus(appConfig);
                currentStatus = libreInfo.status;
                extInfo = libreInfo;
                if (currentStatus === STATUS.READY) statusText = '(已配置)';
                else statusText = '(未配置地址)';
            }

            return {
                title: `${mode.description} ${statusText}`,
                description: mode.title,
                isCommandContext: true,
                commandTrigger: 'mode', // 标记给 index.js 路由回传
                modeId: mode.id,
                currentStatus: currentStatus,
                extInfo: extInfo
            };
        });

        // 如果用户在 /mode 后继续输入，我们可以基于子输入进行简单筛选
        const fuzzyInput = subInput.trim().toLowerCase();
        const filteredItems = items.filter(item =>
            item.title.toLowerCase().includes(fuzzyInput) ||
            item.description.toLowerCase().includes(fuzzyInput)
        );

        callbackSetList(filteredItems);
    },

    handleSelect(itemData, appConfig, callbackSetList) {
        // 优先处理特定操作（如下载词典）
        if (itemData.action === 'download_dict' || itemData.action === 'download_dict_gitee' || itemData.action === 'build_dict_retry_clean') {
            // 如果是清理重试，先删除可能的损坏文件
            if (itemData.action === 'build_dict_retry_clean') {
                const repoPath = appConfig.resourcePath;
                if (repoPath) {
                    ['ecdict-sqlite-28.zip', 'cedict_1_0_ts_utf-8_mdbg.zip', 'ecdict_merged.zip'].forEach(file => {
                        const p = path.join(repoPath, file);
                        if (fs.existsSync(p)) {
                            try { fs.unlinkSync(p); } catch(e) {}
                        }
                    });
                }
            }

            const downloadFn = itemData.action === 'download_dict_gitee' ? handleDownloadDictFromGitee : handleDownloadDict;

            // 异步执行下载，立即返回以保持 UI 响应
            downloadFn(itemData, appConfig, callbackSetList).catch(err => {
                console.error('Download failed:', err);
                callbackSetList([{
                    title: '下载出错',
                    description: err.message || String(err)
                }]);
            });
            return { disableClear: true };
        }

        if (itemData.action === 'open_libre_docs') {
            if (typeof utools !== 'undefined') {
                utools.shellOpenExternal('https://docs.libretranslate.com/');
            }
            return { restoreSearch: true };
        }

        if (!itemData.modeId) return {};

        // 强行从底层同步实时配置，绕过一切潜在的事件循环缓存
        const liveAppConfig = (typeof utools !== 'undefined' ? utools.dbStorage.getItem('app_config') : null) || appConfig;
        
        // 重新动态评估状态，避免由 uTools IPC 传输导致 extInfo 丢失或 currentStatus 过期
        let status = itemData.currentStatus;
        let hasResourcePath = false;

        if (itemData.modeId === 'offline_dict') {
            const dictStatus = getDictStatus(liveAppConfig);
            status = dictStatus.status;
            hasResourcePath = !!dictStatus.path;
        } else if (itemData.modeId === 'ollama') {
            status = getOllamaStatus(liveAppConfig).status;
        } else if (itemData.modeId === 'libretranslate') {
            status = getLibreStatus(liveAppConfig).status;
        }

        if (status === STATUS.UNAVAILABLE || status === STATUS.DOWNLOADING || status === STATUS.DOWNLOADED_UNPROCESSED) {
            if (itemData.modeId === 'offline_dict') {
                appConfig.backends.offline_dict = true;
                appConfig.backends.ollama = false;
                appConfig.backends.libretranslate = false;
                if (typeof utools !== 'undefined') utools.dbStorage.setItem('app_config', appConfig);
                return { openConfigPanel: true, reloadBackend: true };
            } else if (itemData.modeId === 'ollama') {
                appConfig.backends.offline_dict = false;
                appConfig.backends.ollama = true;
                appConfig.backends.libretranslate = false;
                if (typeof utools !== 'undefined') utools.dbStorage.setItem('app_config', appConfig);
                return { openConfigPanel: true, reloadBackend: true };
            } else if (itemData.modeId === 'libretranslate') {
                let instructions = [
                    { title: 'LibreTranslate 未配置', description: '您需要配置 LibreTranslate 的服务器地址才能使用该模式' },
                    { title: '如何配置？', description: '请输入 /libre 命令进行配置' },
                    { title: '如何部署本地服务器？', description: '点击前往官网查看部署指南 (https://docs.libretranslate.com/)', isCommandContext: true, commandTrigger: 'mode', action: 'open_libre_docs' }
                ];
                if (typeof callbackSetList === 'function') {
                    callbackSetList(instructions);
                }
                return { disableClear: true };
            }
        }


        // status === STATUS.READY
        // 变更应用配置
        if (itemData.modeId === 'offline_dict') {
            appConfig.backends.offline_dict = true;
            appConfig.backends.ollama = false;
            appConfig.backends.libretranslate = false;
        } else if (itemData.modeId === 'ollama') {
            appConfig.backends.offline_dict = false;
            appConfig.backends.ollama = true;
            appConfig.backends.libretranslate = false;
        } else if (itemData.modeId === 'libretranslate') {
            appConfig.backends.offline_dict = false;
            appConfig.backends.ollama = false;
            appConfig.backends.libretranslate = true;
        }

        // 持久化保存
        if (typeof utools !== 'undefined') {
            utools.dbStorage.setItem('app_config', appConfig);
        }

        // 返回副作用信号供 preload.js 消费
        return {
            reloadBackend: true,
            restoreSearch: true
        };
    }
};

/**
 * 处理词典下载
 * @param {Object} _itemData 选中项数据（未使用）
 * @param {Object} appConfig 应用配置
 * @param {Function} callbackSetList 列表更新回调
 * @returns {Object} 操作结果
 */
/**
 * 处理从 Gitee 下载词典 (spec-00024)
 */
async function handleDownloadDictFromGitee(_itemData, appConfig, callbackSetList) {
    const repoPath = appConfig.resourcePath;
    if (!repoPath) {
        callbackSetList([{ title: '错误', description: '未配置资源路径' }]);
        return { disableClear: true };
    }

    if (!fs.existsSync(repoPath)) fs.mkdirSync(repoPath, { recursive: true });

    callbackSetList([{
        title: '正在从 Gitee 下载分卷...',
        description: '准备中...',
        isCommandContext: true,
        commandTrigger: 'mode',
        action: 'download_dict_progress'
    }]);

    try {
        const result = await downloadDictsFromGitee({
            destDir: repoPath,
            proxy: appConfig.proxy,
            onProgress: (progress, phase) => {
                if (typeof progress === 'string') {
                  // 处理 builder 返回的消息阶段
                  callbackSetList([{
                      title: progress,
                      description: `${phase === 'ecdict' ? 'ECDICT' : 'CC-CEDICT'} 处理中...`,
                      isCommandContext: true,
                      commandTrigger: 'mode',
                      action: 'download_dict_progress'
                  }]);
                  return;
                }

                const percent = progress.percent || 0;
                const downloaded = formatBytes(progress.downloaded || 0);
                const total = formatBytes(progress.total || 0);
                const dictName = progress.dict === 'ecdict' ? 'ECDICT' : 'CC-CEDICT';
                const sourceName = progress.dict === 'ecdict' ? 'Gitee 分卷' : '原始路径';
                
                callbackSetList([{
                    title: `正在从 ${sourceName} 下载 ${dictName}...`,
                    description: `${percent}% | 已下载 ${downloaded}/${total}`,
                    isCommandContext: true,
                    commandTrigger: 'mode',
                    action: 'download_dict_progress'
                }]);
            }
        });

        if (result.success) {
            // 完成后切换模式
            appConfig.backends.offline_dict = true;
            appConfig.backends.ollama = false;
            appConfig.backends.libretranslate = false;
            if (typeof utools !== 'undefined') utools.dbStorage.setItem('app_config', appConfig);

            callbackSetList([{
                title: '词典已就绪',
                description: '已通过 Gitee 分卷下载并自动完成构建',
                isCommandContext: true,
                commandTrigger: 'mode',
                modeId: 'offline_dict'
            }]);

            return { reloadBackend: true, restoreSearch: true };
        } else {
            callbackSetList([{
                title: 'Gitee 下载失败',
                description: result.error ? result.error.message : '未知错误',
                isCommandContext: true,
                commandTrigger: 'mode',
                action: 'download_dict_gitee'
            }]);
        }
    } catch (err) {
        callbackSetList([{
            title: 'Gitee 下载出错',
            description: err.message || String(err),
            isCommandContext: true,
            commandTrigger: 'mode',
            action: 'download_dict_gitee'
        }]);
    }
}

async function handleDownloadDict(_itemData, appConfig, callbackSetList) {
    const repoPath = appConfig.resourcePath;

    if (!repoPath) {
        callbackSetList([{
            title: '错误',
            description: '未配置资源路径，请先使用 /path 命令设置'
        }]);
        return { disableClear: true };
    }

    // 确保目录存在
    if (!fs.existsSync(repoPath)) {
        try {
            fs.mkdirSync(repoPath, { recursive: true });
        } catch (e) {
            callbackSetList([{
                title: '错误',
                description: '无法创建目录：' + e.message
            }]);
            return { disableClear: true };
        }
    }

    // 获取代理配置
    const proxy = appConfig.proxy;

    // 显示下载进度
    callbackSetList([{
        title: '正在下载 ECDICT 词典...',
        description: '准备中...',
        isCommandContext: true,
        commandTrigger: 'mode',
        action: 'download_dict_progress'
    }]);

    try {
        // 执行下载
        const result = await downloadDicts({
            destDir: repoPath,
            proxy: proxy,
            onProgress: (progress, _phase) => {
                // 实时更新下载进度
                const percent = progress.percent || 0;
                const downloaded = formatBytes(progress.downloaded || 0);
                const total = formatBytes(progress.total || 0);
                const dictName = progress.dict === 'ecdict' ? 'ECDICT' : 'CC-CEDICT';

                callbackSetList([{
                    title: `正在下载 ${dictName} 词典...`,
                    description: `${percent}% | 已下载 ${downloaded}/${total}`,
                    isCommandContext: true,
                    commandTrigger: 'mode',
                    action: 'download_dict_progress'
                }]);
            }
        });

        if (result.success) {
            // 检查词典状态，判断是否需要解压转换
            const status = getDictStatus(appConfig);

            if (status.status === DICT_STATUS.DOWNLOADED_UNPROCESSED) {
                // 已下载但未处理（解压转换），自动执行构建
                callbackSetList([{
                    title: '正在解压和构建词典...',
                    description: '处理中...',
                    isCommandContext: true,
                    commandTrigger: 'mode',
                    action: 'build_dict_progress'
                }]);

                try {
                    const buildResult = await buildAllDicts({
                        repoPath: repoPath,
                        onProgress: (message, percent, phase) => {
                            const dictName = phase === 'ecdict' ? 'ECDICT' : 'CC-CEDICT';
                            callbackSetList([{
                                title: `正在构建 ${dictName}...`,
                                description: `${message} ${percent}%`,
                                isCommandContext: true,
                                commandTrigger: 'mode',
                                action: 'build_dict_progress'
                            }]);
                        }
                    });

                    if (buildResult.success) {
                        // 构建成功，检查最终状态
                        const finalStatus = getDictStatus(appConfig);

                        if (finalStatus.status === DICT_STATUS.READY) {
                            // 词典已就绪，切换到离线词典模式
                            appConfig.backends.offline_dict = true;
                            appConfig.backends.ollama = false;
                            appConfig.backends.libretranslate = false;

                            if (typeof utools !== 'undefined') {
                                utools.dbStorage.setItem('app_config', appConfig);
                            }

                            callbackSetList([{
                                title: '词典已就绪',
                                description: '已切换到离线词典模式',
                                isCommandContext: true,
                                commandTrigger: 'mode',
                                modeId: 'offline_dict'
                            }]);

                            return {
                                reloadBackend: true,
                                restoreSearch: true
                            };
                        } else {
                            // 构建后仍不可用
                            callbackSetList([{
                                title: '词典构建异常',
                                description: '构建完成后词典仍不可用，请检查资源目录',
                                isCommandContext: true,
                                commandTrigger: 'mode',
                                action: 'build_dict_error'
                            }]);
                            return { disableClear: true };
                        }
                    } else {
                        // 构建失败
                        callbackSetList([{
                            title: '词典构建失败',
                            description: buildResult.error ? buildResult.error.message : '解压或构建数据库失败',
                            isCommandContext: true,
                            commandTrigger: 'mode',
                            action: 'build_dict_retry'
                        }]);
                        return { disableClear: true };
                    }
                } catch (err) {
                    callbackSetList([{
                        title: '词典构建出错',
                        description: err.message || String(err),
                        isCommandContext: true,
                        commandTrigger: 'mode',
                        action: 'build_dict_retry'
                    }]);
                    return { disableClear: true };
                }
            }

            if (status.status !== DICT_STATUS.READY) {
                // 状态异常，提示用户
                callbackSetList([{
                    title: '词典下载完成但状态异常',
                    description: `请检查资源目录中是否存在 ecdict.db 和 cccedict.db 文件`,
                    isCommandContext: true,
                    commandTrigger: 'mode',
                    action: 'download_dict_error'
                }]);
                return { disableClear: true };
            }

            // 词典已就绪，切换到离线词典模式
            appConfig.backends.offline_dict = true;
            appConfig.backends.ollama = false;
            appConfig.backends.libretranslate = false;

            if (typeof utools !== 'undefined') {
                utools.dbStorage.setItem('app_config', appConfig);
            }

            callbackSetList([{
                title: '词典已就绪',
                description: '已切换到离线词典模式',
                isCommandContext: true,
                commandTrigger: 'mode',
                modeId: 'offline_dict'
            }]);

            return {
                reloadBackend: true,
                restoreSearch: true
            };
        } else {
            // 下载失败
            callbackSetList([{
                title: '下载失败',
                description: result.error ? result.error.message : '未知错误',
                isCommandContext: true,
                commandTrigger: 'mode',
                action: 'download_dict_retry'
            }]);

            return { disableClear: true };
        }
    } catch (err) {
        callbackSetList([{
            title: '下载出错',
            description: err.message || String(err),
            isCommandContext: true,
            commandTrigger: 'mode',
            action: 'download_dict_retry'
        }]);

        return { disableClear: true };
    }
}

/**
 * 格式化字节数
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
