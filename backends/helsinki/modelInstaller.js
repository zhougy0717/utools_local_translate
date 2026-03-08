const path = require('path');
const ModelDownloader = require('./downloader/modelDownloader');

const MIRROR_ENDPOINT = 'https://hf-mirror.com';

/**
 * 需要下载的两个翻译方向模型（HuggingFace repo ID）
 */
const MODEL_IDS = [
    'Xenova/opus-mt-zh-en',
    'Xenova/opus-mt-en-zh'
];

/**
 * 使用国内镜像串行下载全部所需模型文件。
 *
 * @param {string} destDir - 模型根目录（即 helsinki_models 的父目录）
 * @param {Function} [onProgress] - 进度回调，参数为 { modelId, fileName, downloaded, total, speed }
 *   - modelId: 模型短名，如 'opus-mt-zh-en'
 *   - fileName: 当前文件相对路径，如 'onnx/model_quantized.onnx'
 *   - downloaded: 已下载字节数
 *   - total: 总字节数（可能为 0 表示未知）
 *   - speed: 当前下载速度（B/s）
 * @returns {Promise<void>}
 */
async function installModels(destDir, onProgress) {
    const downloader = new ModelDownloader(MIRROR_ENDPOINT);
    const modelRoot = path.join(destDir, 'helsinki_models');

    for (const modelId of MODEL_IDS) {
        const shortName = modelId.split('/')[1]; // e.g. 'opus-mt-zh-en'
        const modelDestDir = path.join(modelRoot, shortName);

        await downloader.downloadModel(modelId, modelDestDir, {
            onProgress: (fileName, downloaded, total, speed) => {
                if (onProgress) {
                    onProgress({ modelId: shortName, fileName, downloaded, total, speed });
                }
            }
        });
    }
}

module.exports = { installModels };
