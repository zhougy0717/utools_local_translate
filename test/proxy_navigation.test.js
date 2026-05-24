/**
 * 单元测试 — 代理面板返回导航机制 (Spec-00045)
 * 测试 ProxyService 中 fromPanelId 的存取逻辑与 goBack() 调度行为
 */
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

// ─── Mock 环境准备 ────────────────────────────────────────────────────────────

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
    createElement: () => ({
      style: {},
      appendChild: () => {}
    }),
    body: { appendChild: () => {} }
  };
}

if (typeof global.window === 'undefined') {
  global.window = { focus: () => {} };
}

// ─── Mock BackendManager（避免循环依赖，且不依赖真实后端初始化） ──────────────

const mockOpenConfigPanel = {};   // 记录各后端的 openConfigPanel 调用
const mockBackendManager = {
  _getOllamaBackend: () => ({
    openConfigPanel: (cb) => { mockOpenConfigPanel['ollama'] = cb; }
  }),
  openConfigPanel: (cb) => {
    // activeBackend is ollama in test setup
    mockOpenConfigPanel['active'] = cb;
  }
};

// 在 require 缓存中注入 mock，使 ProxyService 的延迟 require 能获取到 mock
// （测试中 proxy_service.js 内的 goBack() 会动态 require backend_manager）
require.cache[require.resolve('../src/core/backend_manager')] = {
  id: require.resolve('../src/core/backend_manager'),
  filename: require.resolve('../src/core/backend_manager'),
  loaded: true,
  exports: mockBackendManager
};

const ProxyService = require('../src/core/proxy_service');

// ─── 测试套件 ─────────────────────────────────────────────────────────────────

describe('Proxy Navigation (Spec-00045)', () => {
  let proxy;

  beforeEach(() => {
    // 每个测试用例使用独立的 ProxyService 实例，避免状态互染
    proxy = new ProxyService({});
    // 清空 mock 调用记录
    Object.keys(mockOpenConfigPanel).forEach(k => delete mockOpenConfigPanel[k]);
  });

  // UT-NAV-001 — 正常记录和获取来源面板 ID
  it('UT-NAV-001: openPanel(fromPanelId) should record and return the fromPanelId', () => {
    // 覆盖 _removeExistingPanel 避免 DOM 依赖
    proxy._removeExistingPanel = () => {};

    proxy.openPanel('ollama');

    assert.strictEqual(
      proxy.getFromPanelId(),
      'ollama',
      'getFromPanelId() 应返回 openPanel() 传入的来源 ID'
    );
  });

  // UT-NAV-002 — 完全关闭面板时清除来源面板 ID
  it('UT-NAV-002: closePanel() should clear fromPanelId', () => {
    proxy._removeExistingPanel = () => {};
    proxy._fromPanelId = 'ollama';

    proxy.closePanel();

    assert.strictEqual(
      proxy.getFromPanelId(),
      null,
      'closePanel() 后 getFromPanelId() 应返回 null'
    );
  });

  // UT-NAV-003 — 正常执行返回上一级面板逻辑
  it('UT-NAV-003: goBack() should clear fromPanelId, emit event, and trigger openConfigPanel on source backend', () => {
    proxy._removeExistingPanel = () => {};
    proxy._fromPanelId = 'ollama';

    let eventFired = false;
    proxy.on(proxy.EVENT_PROXY_CONFIG_CHANGED, () => {
      eventFired = true;
    });

    proxy.goBack();

    assert.strictEqual(
      proxy.getFromPanelId(),
      null,
      'goBack() 后 fromPanelId 应被清除'
    );
    assert.ok(
      eventFired,
      'goBack() 应派发 EVENT_PROXY_CONFIG_CHANGED 事件'
    );
    assert.ok(
      'ollama' in mockOpenConfigPanel || 'active' in mockOpenConfigPanel,
      'goBack() 应触发对应来源后端的 openConfigPanel()'
    );
  });
});
