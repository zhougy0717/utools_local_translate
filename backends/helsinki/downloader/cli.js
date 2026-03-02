const fs = require('node:fs');
const path = require('node:path');
const cliProgress = require('cli-progress');

const ModelDownloader = require('./modelDownloader');

async function main() {
    const configPath = path.join(__dirname, 'config.json');
    if (!fs.existsSync(configPath)) {
        console.error('Config file not found:', configPath);
        process.exit(1);
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    // Default mirror or Hub
    const endpoint = config.endpoint || 'https://hf-mirror.com';
    const models = config.models || [];
    const targetBasePath = config.targetAbsolutePath || path.join(__dirname, 'models');

    if (models.length === 0) {
        console.log('No models defined in config.json. Exiting.');
        return;
    }

    const downloader = new ModelDownloader(endpoint);

    console.log(`\n======================================================`);
    console.log(`Starting Helsinki ONNX Model Downloader CLI`);
    console.log(`Endpoint: ${endpoint}`);
    console.log(`Target  : ${targetBasePath}`);
    console.log(`Models  : ${models.join(', ')}`);
    console.log(`======================================================\n`);

    for (const modelId of models) {
        console.log(`\n>>> Processing model: ${modelId}`);
        const modelTargetDir = path.join(targetBasePath, modelId.split('/').pop());

        try {
            // Pre-check
            const exists = await downloader.checkModelExists(modelId, modelTargetDir);
            if (exists) {
                console.log(`[Skipping] Model ${modelId} already downloaded completely in ${modelTargetDir}.`);
                continue;
            }

            // Create multi-bar tracker matching Python's rich progress if possible
            const multiBar = new cliProgress.MultiBar({
                clearOnComplete: false,
                hideCursor: true,
                format: ' {bar} | {percentage}% | {fileName} | {speed} MB/s | {bytesDownloaded}/{totalBytes}'
            }, cliProgress.Presets.shades_grey);

            // A map to store existing bars for files
            const bars = new Map();

            await downloader.downloadModel(modelId, modelTargetDir, {
                onProgress: (fileName, downloaded, total, speed) => {
                    let bar = bars.get(fileName);
                    if (!bar) {
                        bar = multiBar.create(total, 0, { fileName, speed: '0.00', bytesDownloaded: '0B', totalBytes: (total / 1024 / 1024).toFixed(2) + 'MB' });
                        bars.set(fileName, bar);
                    }

                    const speedMBps = (speed / 1024 / 1024).toFixed(2);
                    const dlMB = (downloaded / 1024 / 1024).toFixed(2);
                    const thMB = (total / 1024 / 1024).toFixed(2);

                    bar.update(downloaded, { speed: speedMBps, bytesDownloaded: `${dlMB}MB`, totalBytes: `${thMB}MB` });
                }
            });

            multiBar.stop();
            console.log(`✅ Model ${modelId} successfully downloaded to ${modelTargetDir}.`);

        } catch (error) {
            console.error(`\n❌ Error downloading model ${modelId}:`, error);
        }
    }
}

main().catch(e => {
    console.error(`Fatal CLI Error:`, e);
    process.exit(1);
});
