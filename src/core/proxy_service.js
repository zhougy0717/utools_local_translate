const { appConfig } = require('../utils/app_config');
const { HttpsProxyAgent } = require('https-proxy-agent');

/**
 * 代理核心业务模块 (ProxyService)
 * 承担所有的配置存取、加密存储映射以及网络连接探测职责
 * 实现接口: _proxyAPI
 */
class ProxyService {
  /**
   * @param {CoreService} core 
   */
  constructor(core) {
    this.core = core;
    this._fetch = null;
  }

  /**
   * 动态加载 node-fetch (CommonJS 兼容解决方案)
   */
  async _getFetch() {
    if (this._fetch) return this._fetch;
    
    // 1. 优先尝试 Node 18+/Electron 原生 fetch
    if (typeof fetch !== 'undefined') {
      console.log('[ProxyService] Using native fetch');
      this._fetch = fetch;
      return this._fetch;
    }

    try {
      // 2. 在 uTools node 16+ 环境中，通过原生动态导入 ESM 模块
      console.log('[ProxyService] Attempting to import node-fetch');
      const module = await eval(`import('node-fetch')`);
      this._fetch = module.default;
      return this._fetch;
    } catch (e) {
      // 降级回 require 如果是 v2 或被打过补丁
      console.warn('[ProxyService] node-fetch dynamic import failed, falling back to require');
      try {
        this._fetch = require('node-fetch');
        return this._fetch;
      } catch (reqErr) {
        console.error('[ProxyService] node-fetch require failed:', reqErr);
        throw new Error('无法加载网络请求模块 (fetch)');
      }
    }
  }

  /**
   * 获取当前代理配置 (含解密后的密码)
   */
  async getProxyConfig() {
    const config = JSON.parse(JSON.stringify(appConfig.load().proxy || {}));
    config.password = appConfig.getProxyPassword();
    return config;
  }

  /**
   * 保存并持久化代理配置
   * @param {Object} config - 基础配置 (不含密码字段)
   * @param {string} password - 需要加密的明文密码 
   */
  async saveProxyConfig(config, password) {
    // 调用 AppConfig 负责基本数据的保存和密码加密存取
    appConfig.saveProxyConfig(config, password);
    return { success: true };
  }

  /**
   * 真实的网络测试流
   * 由 ProxyService 直接协调 Node.js 环境发起
   */
  async testConnection(config) {
    let agent = null;
    if (config.enabled && config.host && config.port) {
      let auth = '';
      if (config.authEnabled && config.username) {
        // 如果传入了新密码则用新密码，否则用存储的密码
        const pass = (config.password !== undefined) ? config.password : appConfig.getProxyPassword();
        auth = pass ? `${config.username}:${pass}@` : `${config.username}@`;
      }
      
      const proxyUrl = `${config.type}://${auth}${config.host}:${config.port}`;
      
      if (config.type === 'socks5') {
        try {
          const { SocksProxyAgent } = require('socks-proxy-agent');
          agent = new SocksProxyAgent(proxyUrl);
        } catch (e) {
          console.error('[ProxyService] socks-proxy-agent error:', e);
          return { success: false, error: 'SOCKS5 模块加载失败: ' + e.message };
        }
      } else {
        try {
          agent = new HttpsProxyAgent(proxyUrl);
        } catch (e) {
          console.error('[ProxyService] HttpsProxyAgent error:', e);
          return { success: false, error: '代理 Agent 创建失败: ' + e.message };
        }
      }
    }

    const testUrl = config.testUrl || 'https://www.google.com';
    const startTime = Date.now();
    try {
      // 获取 fetch 引用
      const fetch = await this._getFetch();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s 超时
      
      const response = await fetch(testUrl, {
        agent,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      const time = Date.now() - startTime;
      if (response.ok) {
        return { success: true, time, status: response.status };
      } else {
        return { success: false, error: `HTTP ${response.status} ${response.statusText}`, time };
      }
    } catch (err) {
      if (err.name === 'AbortError') return { success: false, error: '连接超时' };
      return { success: false, error: err.message };
    }
  }

  /**
   * 关闭配置面板
   * 接口映射: UI 进程调用
   */
  closePanel() {
    if (typeof window !== 'undefined' && typeof window._closeProxyConfigPanel === 'function') {
      window._closeProxyConfigPanel();
    }
  }
}

module.exports = ProxyService;
