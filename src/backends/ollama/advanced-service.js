const path = require('path');
const { PromptManager } = require('./prompt-manager');
const { toNamingStyles } = require('../../utils/text_utils');

/**
 * 进阶翻译面板服务
 * 负责管理工作台的生命周期（打开/关闭）、UI 挂载及与后台的通信桥接
 */
class AdvancedPanelService {
  constructor() {
    this.isOpen = false;
    this.containerId = 'ollama-advanced-panel-container';
    this.initialText = '';
    this.initialResult = '';
    this.initialBackendName = '';
    this.promptManager = new PromptManager();
    this._onPanelClose = null;
  }

  /**
   * 打开面板并挂载到主窗口
   * @param {string} text - 初始待翻译文本
   * @param {Function} onCloseCallback - 面板关闭后的回调
   * @param {OllamaBackend} backend - 当前使用的 Ollama 后端实例
   * @param {string} targetLangCode - 初始目标语言
   * @param {string} initialResult - 预填充的已有翻译结果
   * @param {string} backendName - 已有翻译结果的来源后端名
   */
  openPanel(text = '', onCloseCallback = null, backend = null, targetLangCode = 'zh', initialResult = '', backendName = '') {
    if (typeof document === 'undefined') return;

    this.isOpen = true;
    this.initialText = text;
    this.targetLangCode = targetLangCode;
    this.initialResult = initialResult;
    this.initialBackendName = backendName;
    this._onPanelClose = onCloseCallback;

    if (typeof utools !== 'undefined') {
      utools.setExpendHeight(650);
    }

    // 注入 Bridge API 以供 iframe 调用内容 (高度解耦)
    window._advancedAPI = {
      // 加载初始状态
      loadConfig: () => {
        const config = backend ? backend.configManager.load() : {};
        return {
          initialText: this.initialText,
          initialTargetLang: this.targetLangCode,
          initialResult: this.initialResult,
          initialBackendName: this.initialBackendName,
          models: config.models || [],
          currentModel: config.model || ''
        };
      },
      // 获取初始提示词 (保留 [TEXT] 占位符，由渲染器在执行时动态替换)
      getInitialPrompt: (targetLangCode, taskType = 'advanced') => {
        return this.promptManager.getPromptTemplate(taskType, targetLangCode);
      },
      // 暴露命各风格格式化工具
      formatNaming: (phrase) => toNamingStyles(phrase),
      // 复制文本
      copyText: (text) => {
        if (typeof utools !== 'undefined') utools.copyText(text);
      },
      // 执行翻译任务 (非流式实现，确保稳定性)
      translate: async (payload) => {
        if (!backend) return { success: false, error: 'Ollama 后端未初始化' };
        
        try {
          const data = await backend.fetchChat({
            model: payload.model,
            messages: [
              { role: 'user', content: payload.prompt }
            ],
            stream: false
          });

          if (data.choices && data.choices.length > 0) {
            return { 
              success: true, 
              translation: data.choices[0].message.content.trim(),
              usage: (data.usage?.total_tokens || 0)
            };
          } else {
            return { success: false, error: '接口未返回有效内容' };
          }
        } catch (e) {
          return { success: false, error: e.message };
        }
      },
      // 检查服务状态
      checkStatus: async () => {
        if (!backend) return { online: false, message: '后端未就绪' };
        try {
          const config = backend.configManager.load();
          // 移除末尾的 /v1 以获得 Ollama 根路径，从而调用原生 API /api/tags
          const rootBase = config.apiBase.trim().replace(/\/+$/, '').replace(/\/v1$/, '');
          const res = await backend._request(`${rootBase}/api/tags`, { method: 'GET' });
          return { online: res.ok, message: res.ok ? 'Ollama 已就绪' : `HTTP ${res.status}` };
        } catch (e) {
          return { online: false, message: '无法连接服务' };
        }
      },
      // 打开 Ollama 配置界面
      openOllamaConfig: () => {
        if (backend) {
          this.closePanel(true); // 静默关闭面板
          backend.openConfigPanel(() => {
            // 配置完后可选择性重新打开面板，或简单的重载
            if (onCloseCallback) onCloseCallback();
          });
        }
      },
      // 关闭面板
      closePanel: () => this.closePanel()
    };

    let iframeContainer = document.getElementById(this.containerId);
    if (!iframeContainer) {
      iframeContainer = document.createElement('div');
      iframeContainer.id = this.containerId;
      Object.assign(iframeContainer.style, {
        position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
        zIndex: '999999', backgroundColor: '#ffffff'
      });
      
      const iframe = document.createElement('iframe');
      const htmlPath = path.resolve(__dirname, 'advanced-panel.html');
      iframe.src = 'file://' + htmlPath.replace(/\\/g, '/');
      Object.assign(iframe.style, { width: '100%', height: '100%', border: 'none', display: 'block' });
      
      iframeContainer.appendChild(iframe);
      document.body.appendChild(iframeContainer);
    }
    iframeContainer.style.display = 'block';
  }

  /**
   * 关闭面板并卸载
   * @param {boolean} isSilent - 是否静默关闭（不触发全局重写逻辑）
   */
  closePanel(isSilent = false) {
    this.isOpen = false;
    const container = typeof document !== 'undefined' ? document.getElementById(this.containerId) : null;
    if (container) {
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
    }
    
    if (typeof utools !== 'undefined') {
      utools.setExpendHeight(0);
    }

    if (typeof window !== 'undefined') {
      delete window._advancedAPI;
    }

    if (!isSilent && typeof this._onPanelClose === 'function') {
      this._onPanelClose();
    }
  }
}

module.exports = {
  AdvancedPanelService
};
