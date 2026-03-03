const { parentPort } = require('worker_threads');
const { env, pipeline } = require('@xenova/transformers');
const path = require('path');

// Global cache to store pipeline instances and avoid cold starts on every query
const pipelineCache = new Map();

/**
 * Configure @xenova/transformers environment for local execution
 */
function configureEnvironment(modelDir) {
    env.allowLocalModels = true;
    env.allowRemoteModels = false;
    env.useBrowserCache = false;
    env.useFS = true;
    if (modelDir) {
        env.localModelPath = modelDir;
    }
    // Limit thread count to 1 to slightly improve parallelism when using WASM
    if (env.backends && env.backends.onnx && env.backends.onnx.wasm) {
        env.backends.onnx.wasm.numThreads = 1;
        // Optionally bind wasmPaths if worker is relocated, typically __dirname + separtor
        env.backends.onnx.wasm.wasmPaths = __dirname + path.sep;
    }
}

/**
 * Get or initialize a pipeline instance dynamically
 */
async function getPipeline(pipelineTask, modelName, modelDir) {
    const cacheKey = `${pipelineTask}-${modelName}`;
    if (!pipelineCache.has(cacheKey)) {
        // Only run config when a new model loads
        configureEnvironment(modelDir);

        const initPromise = (async () => {
            try {
                return await pipeline(pipelineTask, modelName, {
                    quantized: true // Ensure running fast quantized forms
                });
            } catch (err) {
                // If initialization fails, cleanup the pending promise
                pipelineCache.delete(cacheKey);
                throw err;
            }
        })();

        pipelineCache.set(cacheKey, initPromise);
    }
    return pipelineCache.get(cacheKey);
}

// Listen for incoming messages from the Main thread
parentPort.on('message', async (msg) => {
    // If it's just an explicit initialization or ping command
    if (msg.type === 'init') {
        try {
            await getPipeline(msg.pipelineTask, msg.modelName, msg.modelDir);
            parentPort.postMessage({ id: msg.id, type: 'init_result', status: 'success' });
        } catch (e) {
            parentPort.postMessage({ id: msg.id, type: 'init_result', status: 'error', message: e.message });
        }
        return;
    }

    // Core query inference
    if (msg.type === 'query') {
        const { id, word, pipelineTask, modelName, modelDir, inferenceOptions } = msg;

        try {
            // Lazy load or reuse existing pipeline
            const pipe = await getPipeline(pipelineTask, modelName, modelDir);

            // Execute the model inference
            const res = await pipe(word, inferenceOptions || {
                max_new_tokens: 500,
                repetition_penalty: 1.2,
                no_repeat_ngram_size: 3
            });

            // Assume parsing structure for typical Seq2Seq translation pipeline
            if (res && res.length > 0 && res[0].translation_text) {
                parentPort.postMessage({ id, type: 'result', found: true, translation: res[0].translation_text });
            } else if (res && res.length > 0 && res[0].generated_text) {
                // Support text-generation task structure as a fallback
                parentPort.postMessage({ id, type: 'result', found: true, translation: res[0].generated_text });
            } else {
                parentPort.postMessage({ id, type: 'result', found: false });
            }

        } catch (e) {
            // Safely return any errors to unblock the frontend tracking map
            parentPort.postMessage({ id, type: 'result', found: false, message: '模型推理异常Worker: ' + e.message });
        }
    }
});
