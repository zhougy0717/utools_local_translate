const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

// 先清除缓存
delete require.cache[require.resolve('../src/core/backend_manager')];
delete require.cache[require.resolve('../src/backends/dict/index.js')];
delete require.cache[require.resolve('../src/backends/ollama/index.js')];

// 先加载后端的 Module 并进行 mock
const dictModule = require('../src/backends/dict/index.js');
const ollamaModule = require('../src/backends/ollama/index.js');

let dictCallArg = null;
let ollamaCallArg = null;
let workerStopCalls = 0;

dictModule.createDictBackend = (config) => { 
    dictCallArg = config; 
    return { type: 'dict', queryWord: () => {}, stopWorker: () => workerStopCalls++ }; 
};
ollamaModule.createOllamaBackend = (config) => { 
    ollamaCallArg = config; 
    return { type: 'ollama', queryWord: () => {}, stopWorker: () => workerStopCalls++ }; 
};

// 最后再加载 BackendManager，它 require 时会拿到已经被 mock 过的 backend 模块
const BackendManager = require('../src/core/backend_manager');

describe('BackendManager', () => {
  let mockConfig;

  beforeEach(() => {
    // 重置状态
    BackendManager.stop();
    dictCallArg = null;
    ollamaCallArg = null;
    workerStopCalls = 0;
    
    // 基础配置
    mockConfig = {
      resourcePath: '/test/path',
      backends: { offline_dict: true, ollama: false },
      ollama: { apiBase: 'test', model: 'test' }
    };
  });
  
  describe('init', () => {
    it('should initialize dict backend by default', () => {
      BackendManager.init(mockConfig);
      assert.deepStrictEqual(dictCallArg, { dictRepoPath: '/test/path' });
      assert.strictEqual(BackendManager.activeBackend.type, 'dict');

    });

    it('should prioritize ollama if enabled', () => {
      mockConfig.backends.ollama = true;
      BackendManager.init(mockConfig);
      assert.deepStrictEqual(ollamaCallArg, mockConfig.ollama);
      assert.strictEqual(BackendManager.activeBackend.type, 'ollama');

    });


  });

  describe('reload and stop', () => {
    it('should stop previous worker during reload', () => {
      BackendManager.init(mockConfig);
      
      mockConfig.backends.ollama = true;
      BackendManager.reload(mockConfig);

      assert.strictEqual(workerStopCalls, 1);
      assert.strictEqual(BackendManager.activeBackend.type, 'ollama');

    });

    it('should stop worker safely and clear references during stop', () => {
      BackendManager.init(mockConfig);
      
      BackendManager.stop();
      
      assert.strictEqual(workerStopCalls, 1);
      assert.strictEqual(BackendManager.activeBackend, null);
      assert.strictEqual(BackendManager.currentConfig, null);

    });
  });

  describe('metadata APIs', () => {
    it('should return correct loading message', () => {
      BackendManager.init(mockConfig);
      assert.strictEqual(BackendManager.getLoadingMessage(), '正在检索本地词典，请稍候...');
      
      mockConfig.backends.ollama = true;
      BackendManager.init(mockConfig);
      assert.strictEqual(BackendManager.getLoadingMessage(), '正在请求 Ollama 服务，请稍候...');

    });
    
    it('should return correct backend name', () => {
      BackendManager.init(mockConfig);
      assert.strictEqual(BackendManager.getBackendName(), '本地词典');
      
      mockConfig.backends.ollama = true;
      BackendManager.init(mockConfig);
      assert.strictEqual(BackendManager.getBackendName(), 'Ollama');

    });
  });

  describe('queryWord', () => {
    it('should throw error if backend is not initialized', () => {
      let calledArg = null;
      BackendManager.queryWord('test', 'zh', (err) => { calledArg = err; }, null);
      assert.strictEqual(calledArg.message, 'Backend not initialized');

    });

    it('should delegate down to the active backend', () => {
      BackendManager.init(mockConfig);
      
      let wasCalled = false;
      BackendManager.activeBackend.queryWord = () => { wasCalled = true; };
      
      BackendManager.queryWord('test', 'zh', () => {}, () => {});
      
      assert.strictEqual(wasCalled, true);

    });
  });
});
