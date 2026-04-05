const { appConfig } = require('../utils/app_config');
const { HttpsProxyAgent } = require('https-proxy-agent');
const EventEmitter = require('events');
const path = require('path');

/**
 * 代理核心业务模块 (ProxyService)
 * 承担所有的配置存取、加密存储映射以及网络连接探测职责
 * 同时负责代理配置界面的渲染与关闭 (UI 自治)
 * 实现接口: _proxyAPI
 */
class ProxyService extends EventEmitter {
  /**
   * @param {CoreService} core 
   */
  constructor(core) {
    super();
    this.core = core;
    this._fetch = null;
    
    // 定义常量
    this.EVENT_PROXY_CONFIG_CHANGED = 'PROX_CONFIG_CHANGED';
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
    
    // 广播配置变更事件
    this.emit(this.EVENT_PROXY_CONFIG_CHANGED, { config });
    
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
   * 打开配置面板 (UI 自治实现)
   * 原逻辑从 preload.js 迁移至此，确保 preload.js 保持极简
   */
  openPanel() {
    if (typeof utools !== 'undefined') {
      utools.setExpendHeight(600);
    }

    // 1. 如果已存在则先移除
    this._removeExistingPanel();

    // 2. 创建容器
    const iframeContainer = document.createElement('div');
    iframeContainer.id = 'proxy-config-container';
    Object.assign(iframeContainer.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      zIndex: '999999',
      backgroundColor: '#f8fafc'
    });

    // 3. 创建 Iframe
    const iframe = document.createElement('iframe');
    const htmlPath = path.resolve(__dirname, '../config/proxy-config.html');
    let normalizedPath = htmlPath.replace(/\\/g, '/');
    if (!normalizedPath.startsWith('/')) normalizedPath = '/' + normalizedPath;
    
    iframe.src = 'file://' + normalizedPath;
    Object.assign(iframe.style, {
      width: '100%',
      height: '100%',
      border: 'none',
      display: 'block'
    });

    iframeContainer.appendChild(iframe);
    document.body.appendChild(iframeContainer);
  }

  /**
   * 内部私有方法：清理残留 DOM
   */
  _removeExistingPanel() {
    const container = document.getElementById('proxy-config-container');
    if (container) {
      container.remove();
    }
  }

  /**
   * 关闭配置面板
   * 接口映射: UI 进程调用
   */
  closePanel() {
    this._removeExistingPanel();
    
    if (typeof utools !== 'undefined') {
      utools.setExpendHeight(0);
    }
    
    if (typeof window !== 'undefined') {
      window.focus();
    }

    // 面板关闭通常意味着配置流程结束，发出广播以确保后端同步
    this.emit(this.EVENT_PROXY_CONFIG_CHANGED);
  }
}

module.exports = ProxyService;
