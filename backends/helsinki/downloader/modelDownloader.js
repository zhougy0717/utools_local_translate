const huggingfaceHub = require('@huggingface/hub');
const path = require('node:path');
const fsPromises = require('node:fs/promises');
const fs = require('node:fs');
const { pipeline } = require('node:stream/promises');
const { HttpsProxyAgent } = require('https-proxy-agent');
const nodeFetch = require('node-fetch');

// Import the FileManager tools created before
const fileManager = require('./fileManager');

/**
 * Valid allowed patterns from the Python equivalent
 */
const ALLOWED_PATTERNS = [
    "config.json",
    "generation_config.json",
    "tokenizer_config.json",
    "tokenizer.json",
    "vocab.json",
    "source.spm",
    "target.spm",
    // We will specifically filter to the "_quantized.onnx" equivalents out of the onnx folder to save space
];

const checkMatch = (filename) => {
    if (ALLOWED_PATTERNS.includes(filename)) {
        return true;
    }
    if (filename.startsWith('onnx/') && filename.endsWith('_quantized.onnx')) {
        return true;
    }
    return false;
};

class ModelDownloader {

    /**
     * @param {string} endpoint The Hugging Face Mirror endpoint
     * @param {string} proxy The proxy server URL
     */
    constructor(endpoint, proxy = '') {
        this.endpoint = endpoint;
        this.proxy = proxy;
        // Enforce the endpoint for internal HF calls indirectly by env as a fallback
        if (endpoint) {
            process.env.HF_ENDPOINT = endpoint;
        }
    }

    /**
     * Returns a fetch implementation that supports proxy if configured
     */
    getFetch() {
        if (!this.proxy) {
            return global.fetch || nodeFetch;
        }

        const agent = new HttpsProxyAgent(this.proxy);
        // Create a wrapper that injects the agent
        return (url, options = {}) => {
            return nodeFetch(url, {
                ...options,
                agent: agent
            });
        };
    }

    /**
     * @param {string} modelId 
     * @returns {Promise<any[]>}
     */
    async fetchModelMetadata(modelId) {
        console.log(`[Meta] Fetching metadata for ${modelId} via ${process.env.HF_ENDPOINT}...`);
        try {
            // listFiles returns an async generator basically but wait, it might return an array or AsyncGenerator
            const files = [];
            for await (const fileInfo of huggingfaceHub.listFiles({
                repo: { type: 'model', name: modelId },
                hubUrl: this.endpoint,
                recursive: true,
                fetch: this.getFetch()
            })) {
                if (checkMatch(fileInfo.path)) {
                    files.push(fileInfo);
                }
            }
            return files;
        } catch (e) {
            throw new Error(`Failed to fetch metadata for ${modelId}: ${e.message}`);
        }
    }

    async checkModelExists(modelId, destDir) {
        try {
            const files = await this.fetchModelMetadata(modelId);
            if (files.length === 0) return false;

            for (const file of files) {
                const targetFilePath = path.join(destDir, file.path);
                const isValid = await fileManager.verifyFile(targetFilePath, file.size);
                if (!isValid) return false;
            }
            return true;
        } catch (e) {
            console.error(e.message);
            return false;
        }
    }

    async downloadModel(modelId, destDir, options = {}) {
        const { onProgress } = options;

        const filesToDownload = await this.fetchModelMetadata(modelId);
        if (filesToDownload.length === 0) {
            throw new Error(`No files found matching the allowed patterns for model: ${modelId}`);
        }

        // We will process them sequentially to avoid overwhelming the network or disk,
        // or potentially concurrently with a pool max
        for (const fileInfo of filesToDownload) {
            const targetFilePath = path.join(destDir, fileInfo.path);

            const isExisting = await fileManager.verifyFile(targetFilePath, fileInfo.size);
            if (isExisting) {
                // Already downloaded completely
                if (onProgress) {
                    onProgress(fileInfo.path, fileInfo.size, fileInfo.size, 0); // instantly complete
                }
                continue;
            }

            // Await to download
            await this.downloadSingleFile(modelId, fileInfo, targetFilePath, onProgress);
        }
    }

    async downloadSingleFile(modelId, fileInfo, targetFilePath, onProgress) {
        const tmpFilePath = `${targetFilePath}.tmp`;

        try {
            await fileManager.ensureDir(path.dirname(targetFilePath));

            // Wait, fetch via normal node fetch while pointing to HUB.
            // But downloadFile() from huggingface/hub returns a Response!
            const downloadResponse = await huggingfaceHub.downloadFile({
                repo: { type: 'model', name: modelId },
                path: fileInfo.path,
                hubUrl: this.endpoint, // enforce hubURL
                fetch: this.getFetch()
            });

            if (!downloadResponse.ok) {
                throw new Error(`Failed to fetch file ${fileInfo.path} from HF API, status: ${downloadResponse.statusText}`);
            }

            // Custom stream tracking pipeline leveraging older File Manager implementation
            const totalSize = parseInt(downloadResponse.headers.get('content-length') || fileInfo.size, 10);

            // Reusing downloadStreamToFile pattern from fileManager but executing natively here
            // Because downloadFile returns native fetch response
            await fileManager.downloadStreamToFile(downloadResponse, targetFilePath, (progressObj) => {
                // re-map the fileName to relative path for better logging
                if (onProgress) {
                    onProgress(fileInfo.path, progressObj.downloaded, totalSize, progressObj.speed);
                }
            });

        } catch (err) {
            console.error(`[Error] Failed dropping ${fileInfo.path}: ${err.message}`);
            try {
                await fsPromises.rm(tmpFilePath, { force: true });
            } catch (e) { }
            throw err;
        }
    }
}

module.exports = ModelDownloader;
