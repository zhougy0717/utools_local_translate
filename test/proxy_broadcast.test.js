const { describe, it } = require('node:test');
const assert = require('node:assert');
const { CoreService } = require('../src/core/core_service');
const BackendManager = require('../src/core/backend_manager');
const { appConfig } = require('../src/utils/app_config');

// 准备测试环境模拟
if (typeof global.utools === 'undefined') {
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
}

if (typeof global.document === 'undefined') {
  global.document = {
    getElementById: () => null,
    createElement: () => ({ style: {}, appendChild: () => {} }),
    body: { appendChild: () => {} }
  };
}

if (typeof global.window === 'undefined') {
  global.window = {
    focus: () => {}
  };
}

// 预初始化 appConfig 缓存
appConfig.load();

describe('Proxy Broadcast Mechanism', () => {
    it('should trigger BackendManager reload when proxy config is saved', async () => {
        const initialConfig = { resourcePath: './test_repo', backends: { offline_dict: true } };
        
        const core = require('../src/core/core_service').coreService;
        core.init();
        
        BackendManager.init(initialConfig);
        const proxy = core.getProxyService();

        let reloadCount = 0;
        const originalReload = BackendManager.reload;
        BackendManager.reload = (cfg) => {
            reloadCount++;
        };

        try {
            // 触发代理变更
            await proxy.saveProxyConfig({ enabled: true, host: '127.0.0.1', port: 7890 }, 'pass');
            assert.strictEqual(reloadCount, 1, 'BackendManager should reload once after proxy save');

            // 触发关闭面板
            proxy.closePanel();
            assert.strictEqual(reloadCount, 2, 'BackendManager should reload again after proxy panel close');
        } finally {
            // 恢复原始方法，防止影响其他测试
            BackendManager.reload = originalReload;
        }
    });
});
