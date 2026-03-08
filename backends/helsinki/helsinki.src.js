const path = require('path');
const { env, pipeline: transformersPipeline } = require('@xenova/transformers');
const { isModelReady } = require('./modelChecker');
const { installModels } = require('./modelInstaller');

/**
 * 配置 @xenova/transformers 使用本地模型
 */
function configureEnvironment(modelDir) {
    env.allowLocalModels = true;
    env.allowRemoteModels = false;
    env.useBrowserCache = false;
    env.useFS = true;
    if (modelDir) {
        env.localModelPath = modelDir;
    }

    // 强制使用 WASM 后端并正确配置路径
    // 注意：__dirname 在被打包后的 helsinki.js 中指向的是 backends/helsinki/
    const wasmRoot = __dirname;

    if (!env.backends) env.backends = {};
    if (!env.backends.onnx) env.backends.onnx = {};

    // 配置 WASM 路径，确保能找到 .wasm 文件
    env.backends.onnx.wasm = {
        wasmPaths: wasmRoot + path.sep,
        numThreads: 1,
        proxy: false // 在 Electron 渲染进程中关闭代理模式，直接执行以避免 Worker 报错
    };

    console.log('[Helsinki] Environment configured:', {
        localModelPath: env.localModelPath,
        wasmPaths: env.backends.onnx.wasm.wasmPaths
    });
}

function createHelsinkiBackend(options) {
    const DEFAULT_MODEL_DIR = path.join(__dirname, '..', '..', 'resources', 'helsinki-models');

    let modelDir;
    const customDir = options?.modelDir || (options?.modelRepoPath ? path.join(options.modelRepoPath, 'helsinki') : null);

    if (customDir && isModelReady(customDir)) {
        modelDir = customDir;
    } else if (isModelReady(DEFAULT_MODEL_DIR)) {
        modelDir = DEFAULT_MODEL_DIR;
    } else {
        modelDir = customDir || DEFAULT_MODEL_DIR;
    }

    const pipelineCache = new Map();
    let unpackPromise = null;

    async function ensureModelUnpacked(onDownloadProgress) {
        if (isModelReady(modelDir)) {
            return { ok: true };
        }

        try {
            await installModels(modelDir, (prog) => {
                if (onDownloadProgress) {
                    const pct = prog.total > 0
                        ? Math.round((prog.downloaded / prog.total) * 100)
                        : 0;
                    const speedKB = Math.round(prog.speed / 1024);
                    onDownloadProgress(
                        `正在下载 ${prog.modelId}/${prog.fileName}: ${pct}% (${speedKB} KB/s)`
                    );
                }
            });
            return { ok: true };
        } catch (err) {
            return { ok: false, message: '模型下载失败: ' + err.message };
        }
    }

    function getUnpackPromise(onDownloadProgress) {
        if (!unpackPromise) {
            unpackPromise = ensureModelUnpacked(onDownloadProgress);
        }
        return unpackPromise;
    }

    async function getPipeline(modelName) {
        if (!pipelineCache.has(modelName)) {
            configureEnvironment(modelDir);
            const pipePromise = transformersPipeline('translation', modelName, {
                quantized: true,
                progress_callback: (info) => {
                    console.log(`[Helsinki] Loading ${modelName}:`, info);
                }
            });
            pipelineCache.set(modelName, pipePromise);
        }
        return pipelineCache.get(modelName);
    }

    function stopWorker() {
        pipelineCache.clear();
        unpackPromise = null;
    }

    function queryWord(word, sourceLang, targetLang, callback, onProgress) {
        if (typeof sourceLang === 'function') {
            callback = sourceLang;
            sourceLang = 'en';
            targetLang = 'zh';
        } else if (typeof targetLang === 'function') {
            callback = targetLang;
            targetLang = 'zh';
        } else if (typeof callback !== 'function') {
            callback = function () { };
        }

        if (!word || !String(word).trim()) {
            return callback(null, { found: false });
        }

        if ((sourceLang !== 'en' && sourceLang !== 'zh') || (targetLang !== 'en' && targetLang !== 'zh') || sourceLang === targetLang) {
            return callback(null, { found: false, message: '不支持的语言对' });
        }

        (async () => {
            try {
                const unpack = await getUnpackPromise(onProgress);
                if (!unpack.ok) {
                    return callback(null, { found: false, message: unpack.message });
                }

                const modelName = sourceLang === 'en'
                    ? 'helsinki_models/opus-mt-en-zh'
                    : 'helsinki_models/opus-mt-zh-en';

                const pipe = await getPipeline(modelName);

                const res = await pipe(String(word).trim(), {
                    max_new_tokens: 500,
                    repetition_penalty: 1.2,
                    no_repeat_ngram_size: 3
                });

                if (res && res.length > 0 && res[0].translation_text) {
                    callback(null, { found: true, translation: res[0].translation_text });
                } else if (res && res.length > 0 && res[0].generated_text) {
                    callback(null, { found: true, translation: res[0].generated_text });
                } else {
                    callback(null, { found: false });
                }

            } catch (e) {
                console.error('[Helsinki] Inference error:', e);
                callback(null, { found: false, message: '模型推理异常: ' + e.message });
            }
        })();
    }

    return { queryWord, stopWorker };
}

module.exports = { createHelsinkiBackend };
