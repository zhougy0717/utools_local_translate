const { CoreService } = require('../src/core/core_service');
const BackendManager = require('../src/core/backend_manager');
const { appConfig } = require('../src/utils/app_config');

// 模拟 uTools 环境
global.utools = {
  setExpendHeight: () => {},
  dbStorage: {
    getItem: (key) => {
        if (key === 'app_config') return { resourcePath: './test_data', backends: { offline_dict: true } };
        return null;
    },
    setItem: () => {}
  }
};
global.document = {
  getElementById: () => null,
  createElement: () => ({ style: {}, appendChild: () => {} }),
  body: { appendChild: () => {} }
};
global.window = {
  focus: () => {}
};

// 预初始化 appConfig 缓存以匹配模拟的 utools
appConfig.load();

async function test() {
  console.log('--- Starting Proxy Broadcast Test ---');
  
  // 1. 初始化
  const initialConfig = { resourcePath: './test_repo', backends: { offline_dict: true } };
  
  // 我们手动注入一个 coreService 到 BackendManager 可能会遇到的 require 环境中
  // 或者直接使用导出的单例
  const core = require('../src/core/core_service').coreService;
  core.init();
  
  BackendManager.init(initialConfig);
  const proxy = core.getProxyService();

  // 2. 模拟 reload 被调用
  let reloadCount = 0;
  BackendManager.reload = (cfg) => {
    reloadCount++;
    console.log(`[Test] BackendManager.reload called! (Count: ${reloadCount})`);
  };

  // 3. 触发代理变更
  console.log('[Test] Triggering saveProxyConfig...');
  await proxy.saveProxyConfig({ enabled: true, host: '127.0.0.1', port: 7890 }, 'pass');

  // 4. 验证
  if (reloadCount === 1) {
    console.log('✅ Success: BackendManager reloaded on saveProxyConfig');
  } else {
    console.error('❌ Failure: BackendManager did not reload on saveProxyConfig (Reload count: ' + reloadCount + ')');
  }

  // 5. 触发关闭面板
  console.log('[Test] Triggering closePanel...');
  proxy.closePanel();

  if (reloadCount === 2) {
    console.log('✅ Success: BackendManager reloaded on closePanel');
  } else {
    console.error('❌ Failure: BackendManager did not reload on closePanel (Reload count: ' + reloadCount + ')');
  }

  console.log('--- Test Complete ---');
}

test().catch(err => {
    console.error('Test failed with error:', err);
    process.exit(1);
});
