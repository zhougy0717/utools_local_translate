globalThis.self = globalThis;
(async () => {
    const { env, pipeline } = await import('@xenova/transformers/dist/transformers.min.js');
    env.allowLocalModels = true;
    env.allowRemoteModels = false;
    env.localModelPath = './resources/helsinki-models';
    try {
        const pipe = await pipeline('translation', 'helsinki_models/opus-mt-en-zh', { quantized: true });
        const res = await pipe('hello');
        console.log('Result:', res);
    } catch (e) {
        console.error('Error loading:', e);
    }
})();
