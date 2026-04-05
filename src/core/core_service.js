const ProxyService = require('./proxy_service');

/**
 * 核心服务管理类 (CoreService)
 * 负责插件所有业务服务的生命周期管理与 IPC 映射
 */
class CoreService {
  constructor() {
    // 实例化具体的业务服务
    this.proxyService = new ProxyService(this);
    
    this._initialized = false;
  }

  /**
   * 初始化并注册 API 到 window
   */
  init() {
    if (this._initialized) return;
    
    // 注入 ProxyService 实例作为翻译插件的全局代理 API
    if (typeof window !== 'undefined') {
      window._proxyAPI = this.proxyService;
      console.log('[CoreService] _proxyAPI injected into window');
    }

    this._initialized = true;
  }

  /**
   * 获取代理服务实例
   */
  getProxyService() {
    return this.proxyService;
  }
}

// 导出单例
const coreService = new CoreService();

module.exports = {
  CoreService,
  coreService
};
