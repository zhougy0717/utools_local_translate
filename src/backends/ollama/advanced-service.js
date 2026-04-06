const path = require('path');
const { PromptManager } = require('./prompt-manager');

/**
 * 进阶翻译面板服务
 * 负责管理工作台的生命周期（打开/关闭）、UI 挂载及与后台的通信桥接
 */
class AdvancedPanelService {
  constructor() {
    this.isOpen = false;
    this.containerId = 'ollama-advanced-panel-container';
    this.initialText = '';
    this.promptManager = new PromptManager();
    this._onPanelClose = null;
  }

  /**
   * 打开面板并挂载到主窗口
   * @param {string} text - 初始待翻译文本
   * @param {Function} onCloseCallback - 面板关闭后的回调
   * @param {OllamaBackend} backend - 当前使用的 Ollama 后端实例
   * @param {string} targetLangCode - 初始目标语言
   */
  openPanel(text = '', onCloseCallback = null, backend = null, targetLangCode = 'zh') {
    if (typeof document === 'undefined') return;

    this.isOpen = true;
    this.initialText = text;
    this.targetLangCode = targetLangCode;
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
          models: config.models || [],
          currentModel: config.model || ''
        };
      },
      // 获取初始提示词
      getInitialPrompt: (inputText, targetLangCode) => {
        const template = this.promptManager.getDefaultTemplate();
        let targetLang = '中文';
        if (targetLangCode === 'en') targetLang = '英文';
        else if (targetLangCode === 'ja') targetLang = '日语';
        
        return this.promptManager.buildPrompt(template, {
          text: inputText,
          targetLang: targetLang
        });
      },
      // 执行翻译任务 (非流式实现，确保稳定性)
      translate: async (payload) => {
        if (!backend) return { success: false, error: 'Ollama 后端未初始化' };
        
        return new Promise((resolve) => {
          // 这里的 backend.queryWord 逻辑是直接发送给接口。
          // 我们需要更精细地控制 Prompt。目前 queryWord 内部写死了系统提示词。
          // 为满足进阶需求，我们可能需要临时修改 backend 配置或调用其内部请求逻辑。
          // 方案：使用 backend 的配置进行请求，但直接向消息体发送用户自定义内容。
          
          let apiBase = (backend.config.apiBase || '').trim().replace(/\/+$/, '');
          if (apiBase && !apiBase.endsWith('/v1')) {
            apiBase += '/v1';
          }
          const endpoint = `${apiBase}/chat/completions`;
          
          const requestPayload = {
            model: payload.model || backend.config.model,
            messages: [
              { role: 'user', content: payload.prompt } // 进阶模式下，prompt 已经是包含了原文的完整指令
            ],
            stream: false
          };

          backend._request(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${backend.config.apiKey}`
            },
            body: JSON.stringify(requestPayload)
          })
          .then(res => res.json())
          .then(data => {
            if (data.choices && data.choices.length > 0) {
              resolve({ 
                success: true, 
                translation: data.choices[0].message.content.trim(),
                usage: (data.usage?.total_tokens || 0)
              });
            } else {
              resolve({ success: false, error: '接口未返回有效翻译' });
            }
          })
          .catch(e => resolve({ success: false, error: e.message }));
        });
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
