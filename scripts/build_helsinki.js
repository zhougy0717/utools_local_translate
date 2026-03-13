const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

// Create dummy sharp placeholder
const dummySharpPath = path.resolve(__dirname, 'dummy-sharp.js');
fs.writeFileSync(dummySharpPath, 'module.exports = {};');

// Copy WASM files from onnxruntime-web to the backends directory
const wasmSrc = path.join(__dirname, '..', 'node_modules', 'onnxruntime-web', 'dist');
const wasmDest = path.join(__dirname, '..', 'backends', 'helsinki');

const wasmFiles = [
    'ort-wasm.wasm',
    'ort-wasm-threaded.wasm',
    'ort-wasm-simd.wasm',
    'ort-wasm-simd-threaded.wasm'
];

wasmFiles.forEach(file => {
    const srcFile = path.join(wasmSrc, file);
    if (fs.existsSync(srcFile)) {
        fs.copyFileSync(srcFile, path.join(wasmDest, file));
    }
});

esbuild.build({
    entryPoints: ['backends/helsinki/helsinki.src.js'],
    bundle: true,
    outfile: 'backends/helsinki/helsinki.js',
    platform: 'node',
    target: 'node16',
    format: 'cjs',
    alias: {
        'onnxruntime-node': 'onnxruntime-web',
        'sharp': dummySharpPath
    },
    define: {
        'import.meta.url': "'file:///C:/dummy'"
    },
    external: [
        'fs', 'path', 'zlib', 'tar', 'https-proxy-agent', 'node-fetch'
    ]
}).then(() => {
    console.log('Build complete: backends/helsinki/helsinki.js');
}).catch((e) => {
    console.error(e);
    process.exit(1);
});
