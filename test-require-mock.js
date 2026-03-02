const crypto = require('crypto'); // just to ensure module is available
const Module = require('module');

// Intercept require to force WASM
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
    if (id === 'onnxruntime-node') {
        return originalRequire.call(this, 'onnxruntime-web');
    }
    return originalRequire.apply(this, arguments);
};

(async () => {
    try {
        const { env, pipeline } = await import('@xenova/transformers');
        env.allowLocalModels = true;
        env.allowRemoteModels = false;
        env.localModelPath = './resources/helsinki-models';

        const pipe = await pipeline('translation', 'helsinki_models/opus-mt-en-zh', { quantized: true });
        const res = await pipe('hello');
        console.log('Result:', res);
    } catch (e) {
        console.error('Error:', e);
    }
})();
