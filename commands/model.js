const path = require('path');
const { isModelReady } = require('../backends/helsinki/modelChecker');
const { installModels } = require('../backends/helsinki/modelInstaller');

const MODELS = [
    {
        id: 'helsinki-nlp/opus-mt',
        title: 'Helsinki-NLP (ONNX)',
        description: '当前内置基础模型。支持中英双向离线翻译。翻译质量：基础可用，适合简单字句和日常短句获取主干意思。'
    },
    {
        id: 'placeholder',
        title: 'HY-MT1.5B (待支持)',
        description: '预留的高性能模型，敬请期待。'
    }
];


module.exports = {
    trigger: 'model',
    title: '选择翻译模型',
    description: '切换底层用于推理翻译质量的大预言模型 (/model)',

    handleSearch(subInput, callbackSetList) {
        const items = MODELS.map(model => {
            return {
                title: model.description,
                description: model.title,
                isCommandContext: true,
                commandTrigger: 'model', // 标记给 index.js 路由回传
                modelId: model.id
            };
        });

        const fuzzyInput = subInput.trim().toLowerCase();
        const filteredItems = items.filter(item =>
            item.title.toLowerCase().includes(fuzzyInput) ||
            item.description.toLowerCase().includes(fuzzyInput)
        );

        callbackSetList(filteredItems);
    },

    handleSelect(itemData, appConfig, callbackSetList) {
        if (!itemData.modelId || itemData.modelId === 'placeholder') return {};

        // 更新配置：标记为 helsinki 模式并持久化
        if (!appConfig.backends) {
            appConfig.backends = {};
        }
        appConfig.backends.selected_model = itemData.modelId;
        appConfig.backends.helsinki_model = true;

        if (typeof utools !== 'undefined') {
            utools.dbStorage.setItem('app_config', appConfig);
        }

        // Helsinki 模型存放路径解析逻辑
        // 1. 如果有自定义路径且模型已就绪，优先使用自定义路径
        // 2. 否则，如果内置路径模型已就绪，使用内置路径（避免重复下载）
        // 3. 如果都不就绪，优先选择自定义路径作为下载目标；若无自定义路径则用内置路径
        const DEFAULT_MODEL_DIR = path.join(__dirname, '..', 'resources', 'helsinki-models');
        let modelDir;
        const customDir = appConfig.resourcePath ? path.join(appConfig.resourcePath, 'helsinki') : null;

        if (customDir && isModelReady(customDir)) {
            modelDir = customDir;
        } else if (isModelReady(DEFAULT_MODEL_DIR)) {
            modelDir = DEFAULT_MODEL_DIR;
        } else {
            modelDir = customDir || DEFAULT_MODEL_DIR;
        }

        if (!isModelReady(modelDir)) {
            // 模型不存在：立即反馈 UI，然后异步下载
            if (callbackSetList) {
                callbackSetList([{
                    title: '⬇️ 开始下载 Helsinki 模型...',
                    description: '正在连接 hf-mirror.com，请稍候'
                }]);
            }

            // 异步下载，不阻塞 handleSelect 返回
            installModels(modelDir, (prog) => {
                if (callbackSetList) {
                    const pct = prog.total > 0 ? Math.round((prog.downloaded / prog.total) * 100) : 0;
                    const speedKB = Math.round(prog.speed / 1024);
                    callbackSetList([{
                        title: `⬇️ 下载中 ${prog.modelId}/${prog.fileName}`,
                        description: `${pct}%  ·  ${speedKB} KB/s`
                    }]);
                }
            }).then(() => {
                if (callbackSetList) {
                    callbackSetList([{
                        title: '✅ 模型下载完成',
                        description: '即将切换至 Helsinki 翻译模式'
                    }]);
                }
                // 延迟触发 search 事件，让 preload.js 重新初始化后端
                if (typeof utools !== 'undefined') {
                    setTimeout(() => {
                        utools.setSubInputValue('');
                    }, 1200);
                }
            }).catch((err) => {
                if (callbackSetList) {
                    callbackSetList([{
                        title: '❌ 下载失败',
                        description: err.message
                    }]);
                }
            });

            // 同步返回空信号，不触发后端重载（等下载完成后再延迟重载）
            return {};
        }

        // 模型已就绪，直接切换后端
        return {
            reloadBackend: true,
            restoreSearch: true
        };
    }
};
