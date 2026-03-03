const path = require('path');
const fs = require('fs');
const { Worker } = require('worker_threads');
const crypto = require('crypto');

function createHelsinkiBackend(options) {
    const archivePath = options?.modelArchivePath || path.join(__dirname, '..', '..', 'resources', 'helsinki-opus-en-zh.tar.gz');
    const modelDir = options?.modelDir || path.join(__dirname, '..', '..', 'resources', 'helsinki-models');

    let unpackPromise = null;
    let worker = null;
    const pendingRequests = new Map();

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

    function getWorker() {
        if (!worker) {
            worker = new Worker(path.join(__dirname, '..', 'worker.js'));

            worker.on('message', (msg) => {
                if (msg.type === 'result') {
                    const callback = pendingRequests.get(msg.id);
                    if (callback) {
                        pendingRequests.delete(msg.id);
                        // Forward the result structure natively
                        callback(null, msg);
                    }
                }
            });

            worker.on('error', (err) => {
                console.error('Helsinki Worker error:', err);
                for (const [id, cb] of pendingRequests.entries()) {
                    cb(null, { found: false, message: 'Worker 发生严重错误: ' + err.message });
                }
                pendingRequests.clear();
                worker = null;
            });

            worker.on('exit', (code) => {
                if (code !== 0) {
                    console.error(`Helsinki Worker stopped with exit code ${code}`);
                }
                worker = null;
            });
        }
        return worker;
    }

    function stopWorker() {
        if (worker) {
            worker.terminate();
            worker = null;

            // Abort and clear all pending requests safely
            for (const [id, cb] of pendingRequests.entries()) {
                cb(null, { found: false, message: 'Worker 已被主动终止' });
            }
            pendingRequests.clear();
        }
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

                const id = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');

                pendingRequests.set(id, callback);

                const w = getWorker();
                const modelName = sourceLang === 'en' ? 'helsinki_models/opus-mt-en-zh' : 'helsinki_models/opus-mt-zh-en';

                w.postMessage({
                    id,
                    type: 'query',
                    word: String(word).trim(),
                    pipelineTask: 'translation',
                    modelName: modelName,
                    modelDir: modelDir
                });

            } catch (e) {
                callback(null, { found: false, message: '模型代理队列异常: ' + e.message });
            }
        })();
    }

    return { queryWord, stopWorker };
}

module.exports = { createHelsinkiBackend };
