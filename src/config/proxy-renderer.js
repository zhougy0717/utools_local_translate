const _proxyAPI = window.parent._proxyAPI;

const dom = {
    authEnabled: document.getElementById('proxy-auth-enabled'),
    type: document.getElementById('proxy-type'),
    host: document.getElementById('proxy-host'),
    port: document.getElementById('proxy-port'),
    username: document.getElementById('proxy-username'),
    password: document.getElementById('proxy-password'),
    testUrl: document.getElementById('proxy-test-url'),
    btnTest: document.getElementById('btn-test'),
    btnSave: document.getElementById('btn-save'),
    resultMessage: document.getElementById('result-message'),
    proxyFields: document.getElementById('proxy-fields'),
    authFields: document.getElementById('auth-fields')
};

/**
 * 加载当前配置
 */
async function loadConfig() {
    try {
        const config = await _proxyAPI.getProxyConfig();
        dom.authEnabled.checked = !!config.authEnabled;
        dom.type.value = config.type || 'http';
        dom.host.value = config.host || '';
        dom.port.value = config.port || '';
        dom.username.value = config.username || '';
        dom.password.value = config.password || '';
        dom.testUrl.value = config.testUrl || 'https://www.google.com';
        
        toggleAuthFields();
    } catch (e) {
        showResult('读取配置失败: ' + e.message, 'error');
    }
}

/**
 * 已废弃：根据启用状态显示/隐藏主字段 (现在的原则是配置页面仅负责配置，开关由各模块自决)
 */
function toggleFields() {
    // 不再执行任何操作，所有字段默认可编辑
}

/**
 * 根据启用状态显示/隐藏认证字段
 */
function toggleAuthFields() {
    dom.authFields.style.display = dom.authEnabled.checked ? 'block' : 'none';
}

/**
 * 显示结果消息
 */
function showResult(message, type) {
    dom.resultMessage.textContent = message;
    dom.resultMessage.className = type;
    dom.resultMessage.style.display = 'block';
    
    // 5秒后自动隐藏（成功消息）
    if (type === 'success') {
        setTimeout(() => {
            dom.resultMessage.style.display = 'none';
        }, 5000);
    }
}

/**
 * 获取当前表单数据
 */
function getFormData() {
    let host = dom.host.value.trim();
    // 支持同时配置或不配置 http(s):// 头
    host = host.replace(/^https?:\/\//i, '');
    
    return {
        enabled: true, // 始终返回 true 确保底层 getProxy() 能读取
        authEnabled: dom.authEnabled.checked,
        type: dom.type.value,
        host: host,
        port: dom.port.value.trim(),
        username: dom.username.value.trim(),
        password: dom.password.value, // 密码不 trim
        testUrl: dom.testUrl.value.trim()
    };
}

/**
 * 内部保存逻辑：验证并执行存盘
 * @returns {Promise<boolean>} 是否保存成功
 */
async function performSave() {
    const data = getFormData();
    
    // 如果填写了任何一项，校验必填项
    if (data.host || data.port) {
        if (!data.host || !data.port) {
            showResult('请完整填写代理地址和端口', 'error');
            return false;
        }
        if (data.authEnabled && !data.username) {
            showResult('启用了认证但未填写用户名', 'error');
            return false;
        }
    }

    try {
        const { password, ...config } = data;
        await _proxyAPI.saveProxyConfig(config, password);
        return true;
    } catch (e) {
        showResult('保存失败: ' + e.message, 'error');
        return false;
    }
}

// 绑定事件
dom.authEnabled.addEventListener('change', toggleAuthFields);

dom.btnTest.addEventListener('click', async () => {
    // 1. 先执行保存逻辑 (尊重用户显式行为：测试即认可当前输入有效)
    const saved = await performSave();
    if (!saved) return;
    
    // 2. 获取最新数据发起测试
    const data = getFormData();

    dom.btnTest.classList.add('btn-loading');
    dom.btnTest.disabled = true;
    showResult('配置已保存，正在测试连通性...', 'success');

    try {
        const result = await _proxyAPI.testConnection(data);
        if (result.success) {
            showResult(`配置已保存，测试成功！响应时间: ${result.time}ms`, 'success');
        } else {
            // 注意：连接失败依然保留“配置已保存”的提示文字
            showResult(`配置已保存，但连接测试未通过: ${result.error}`, 'error');
        }
    } catch (e) {
        showResult('系统错误: ' + e.message, 'error');
    } finally {
        dom.btnTest.classList.remove('btn-loading');
        dom.btnTest.disabled = false;
    }
});

dom.btnSave.addEventListener('click', async () => {
    const saved = await performSave();
    if (saved) {
        showResult('配置已保存', 'success');
    }
});

// 绑定 Esc 键退出
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        _proxyAPI.closePanel();
    }
});

// 初始化
loadConfig();
