// 测试所有模块是否能正确加载
console.log('开始测试模块加载...\n');

const modules = [
  './src/core/backend_manager',
  './src/utils/view_presenter',
  './src/utils/utools_helper',
  './src/commands/index.js',
  './src/utils/app_config',
  './src/backends/dict/config',
  './src/backends/ollama/config',
  './src/backends/libretranslate/config',
  './src/backends/base/config',
  './src/utils/storage_adapter'
];

let hasError = false;

for (const mod of modules) {
  try {
    require(mod);
    console.log('✓', mod);
  } catch (e) {
    hasError = true;
    console.error('✗', mod);
    console.error('  错误:', e.message);
  }
}

console.log('\n' + (hasError ? '有模块加载失败！' : '所有模块加载成功！'));
