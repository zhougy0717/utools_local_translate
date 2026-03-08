const fs = require('fs');
const path = require('path');

/**
 * 两个翻译方向所需的模型目录名（位于 modelDir/helsinki_models/ 下）
 */
const REQUIRED_MODELS = [
    'opus-mt-en-zh',
    'opus-mt-zh-en'
];

/**
 * 检测指定目录下，两个翻译方向的模型文件是否均已就绪。
 * 就绪条件：modelDir/helsinki_models/{model}/onnx/ 下存在 *_quantized.onnx 文件。
 *
 * @param {string} modelDir - 模型根目录（即 helsinki_models 的父目录）
 * @returns {boolean}
 */
function isModelReady(modelDir) {
    for (const model of REQUIRED_MODELS) {
        const onnxDir = path.join(modelDir, 'helsinki_models', model, 'onnx');
        if (!fs.existsSync(onnxDir)) return false;
        let files;
        try {
            files = fs.readdirSync(onnxDir);
        } catch (e) {
            return false;
        }
        const hasQuantized = files.some(f => f.endsWith('_quantized.onnx'));
        if (!hasQuantized) return false;
    }
    return true;
}

module.exports = { isModelReady };
