const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const BackendManager = require('../src/core/backend_manager');

// 为了兼容 node:test 拦截模块级工厂被代理
const dictModule = require('../backends/dict/index.js');
const helsinkiModule = require('../backends/helsinki/helsinki.js');
const ollamaModule = require('../backends/ollama/index.js');

describe('BackendManager', () => {
  let mockConfig;
  let o_createDict, o_createHelsinki, o_createOllama;

  let dictCallArg = null;
  let helsinkiCallArg = null;
  let ollamaCallArg = null;
  let workerStopCalls = 0;

  beforeEach(() => {
    // 重置状态
    BackendManager.stop();
    dictCallArg = null;
    helsinkiCallArg = null;
    ollamaCallArg = null;
    workerStopCalls = 0;
    
    // 注入 mock 存根
    o_createDict = dictModule.createDictBackend;
    o_createHelsinki = helsinkiModule.createHelsinkiBackend;
    o_createOllama = ollamaModule.createOllamaBackend;

    dictModule.createDictBackend = (config) => { dictCallArg = config; return { type: 'dict', queryWord: () => {}, stopWorker: () => workerStopCalls++ }; };
    helsinkiModule.createHelsinkiBackend = (config) => { helsinkiCallArg = config; return { type: 'helsinki', queryWord: () => {}, stopWorker: () => workerStopCalls++ }; };
    ollamaModule.createOllamaBackend = (config) => { ollamaCallArg = config; return { type: 'ollama', queryWord: () => {}, stopWorker: () => workerStopCalls++ }; };
    
    // 基础配置
    mockConfig = {
      resourcePath: '/test/path',
      backends: { offline_dict: true, helsinki_model: false, ollama: false },
      ollama: { apiBase: 'test', model: 'test' }
    };
  });
  
  const restoreMock = () => {
    dictModule.createDictBackend = o_createDict;
    helsinkiModule.createHelsinkiBackend = o_createHelsinki;
    ollamaModule.createOllamaBackend = o_createOllama;
  };

  describe('init', () => {
    it('should initialize dict backend by default', () => {
      BackendManager.init(mockConfig);
      assert.deepStrictEqual(dictCallArg, { dictRepoPath: '/test/path' });
      assert.strictEqual(BackendManager.activeBackend.type, 'dict');
      restoreMock();
    });

    it('should prioritize ollama if enabled', () => {
      mockConfig.backends.ollama = true;
      BackendManager.init(mockConfig);
      assert.deepStrictEqual(ollamaCallArg, mockConfig.ollama);
      assert.strictEqual(BackendManager.activeBackend.type, 'ollama');
      restoreMock();
    });

    it('should prioritize helsinki if enabled and ollama is disabled', () => {
      mockConfig.backends.helsinki_model = true;
      BackendManager.init(mockConfig);
      assert.deepStrictEqual(helsinkiCallArg, { modelRepoPath: '/test/path' });
      assert.strictEqual(BackendManager.activeBackend.type, 'helsinki');
      restoreMock();
    });
  });

  describe('reload and stop', () => {
    it('should stop previous worker during reload', () => {
      BackendManager.init(mockConfig);
      
      mockConfig.backends.ollama = true;
      BackendManager.reload(mockConfig);

      assert.strictEqual(workerStopCalls, 1);
      assert.strictEqual(BackendManager.activeBackend.type, 'ollama');
      restoreMock();
    });

    it('should stop worker safely and clear references during stop', () => {
      BackendManager.init(mockConfig);
      
      BackendManager.stop();
      
      assert.strictEqual(workerStopCalls, 1);
      assert.strictEqual(BackendManager.activeBackend, null);
      assert.strictEqual(BackendManager.currentConfig, null);
      restoreMock();
    });
  });

  describe('metadata APIs', () => {
    it('should return correct loading message', () => {
      BackendManager.init(mockConfig);
      assert.strictEqual(BackendManager.getLoadingMessage(), '正在检索本地词典，请稍候...');

      mockConfig.backends.helsinki_model = true;
      BackendManager.init(mockConfig);
      assert.strictEqual(BackendManager.getLoadingMessage(), '调用本地大模型，可能需要数秒钟，请稍候...');
      
      mockConfig.backends.ollama = true;
      BackendManager.init(mockConfig);
      assert.strictEqual(BackendManager.getLoadingMessage(), '正在请求 Ollama 服务，请稍候...');
      restoreMock();
    });
    
    it('should return correct backend name', () => {
      BackendManager.init(mockConfig);
      assert.strictEqual(BackendManager.getBackendName(), '词典查询时延');

      mockConfig.backends.helsinki_model = true;
      BackendManager.init(mockConfig);
      assert.strictEqual(BackendManager.getBackendName(), '模型查询时延');
      
      mockConfig.backends.ollama = true;
      BackendManager.init(mockConfig);
      assert.strictEqual(BackendManager.getBackendName(), 'Ollama 查询时延');
      restoreMock();
    });
  });

  describe('queryWord', () => {
    it('should throw error if backend is not initialized', () => {
      let calledArg = null;
      BackendManager.queryWord('test', 'en', 'zh', (err) => { calledArg = err; }, null);
      assert.strictEqual(calledArg.message, 'Backend not initialized');
      restoreMock();
    });

    it('should delegate down to the active backend', () => {
      BackendManager.init(mockConfig);
      
      let wasCalled = false;
      BackendManager.activeBackend.queryWord = () => { wasCalled = true; };
      
      BackendManager.queryWord('test', 'en', 'zh', () => {}, () => {});
      
      assert.strictEqual(wasCalled, true);
      restoreMock();
    });
  });
});
