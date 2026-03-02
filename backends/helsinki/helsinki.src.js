const path = require('path');
const fs = require('fs');
const tar = require('tar');
const { env, pipeline } = require('@xenova/transformers');

function createHelsinkiBackend(options) {
    const archivePath = options?.modelArchivePath || path.join(__dirname, '..', '..', 'resources', 'helsinki-opus-en-zh.tar.gz');
    const modelDir = options?.modelDir || path.join(__dirname, '..', '..', 'resources', 'helsinki-models');

    let pipelinePromises = {
        'en-zh': null,
        'zh-en': null
    };
    let unpackPromise = null;

    async function ensureModelUnpacked() {
        if (!fs.existsSync(modelDir)) {
            return { ok: false, message: '模型未就绪，请确保已下载并放置在指定目录下' };
        }
        return { ok: true };
    }

    function getUnpackPromise() {
        if (!unpackPromise) {
            unpackPromise = ensureModelUnpacked();
        }
        return unpackPromise;
    }

    async function loadPipeline(sourceLang, targetLang) {
        const key = `${sourceLang}-${targetLang}`;
        if (!pipelinePromises[key]) {
            pipelinePromises[key] = (async () => {

                // 配置本地模型路径与离线支持
                env.allowLocalModels = true;
                env.allowRemoteModels = false;
                env.useBrowserCache = false;
                env.useFS = true;
                env.localModelPath = modelDir;
                if (env.backends && env.backends.onnx && env.backends.onnx.wasm) {
                    env.backends.onnx.wasm.wasmPaths = __dirname + path.sep;
                    env.backends.onnx.wasm.numThreads = 1;
                }

                const modelName = sourceLang === 'en' ? 'helsinki_models/opus-mt-en-zh' : 'helsinki_models/opus-mt-zh-en';
                return await pipeline('translation', modelName, {
                    quantized: true
                });
            })();
        }
        return await pipelinePromises[key];
    }

    function queryWord(word, sourceLang, targetLang, callback) {
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
                const unpack = await getUnpackPromise();
                if (!unpack.ok) {
                    return callback(null, { found: false, message: unpack.message });
                }

                const pipe = await loadPipeline(sourceLang, targetLang);
                const res = await pipe(String(word).trim(), {
                    max_new_tokens: 500,
                    repetition_penalty: 1.2,
                    no_repeat_ngram_size: 3
                });

                if (res && res.length > 0 && res[0].translation_text) {
                    callback(null, { found: true, translation: res[0].translation_text });
                } else {
                    callback(null, { found: false });
                }
            } catch (e) {
                callback(null, { found: false, message: '模型推理异常: ' + e.message });
            }
        })();
    }

    return { queryWord };
}

module.exports = { createHelsinkiBackend };
