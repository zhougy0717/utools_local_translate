const _proxyAPI = window.parent._proxyAPI;

const dom = {
    enabled: document.getElementById('proxy-enabled'),
    authEnabled: document.getElementById('proxy-auth-enabled'),
    type: document.getElementById('proxy-type'),
    host: document.getElementById('proxy-host'),
    port: document.getElementById('proxy-port'),
    username: document.getElementById('proxy-username'),
    password: document.getElementById('proxy-password'),
    testUrl: document.getElementById('proxy-test-url'),
    btnTest: document.getElementById('btn-test'),
    btnSave: document.getElementById('btn-save'),
    btnCancel: document.getElementById('btn-cancel'),
    backToDict: document.getElementById('back-to-dict'),
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
        dom.enabled.checked = !!config.enabled;
        dom.authEnabled.checked = !!config.authEnabled;
        dom.type.value = config.type || 'http';
        dom.host.value = config.host || '';
        dom.port.value = config.port || '';
        dom.username.value = config.username || '';
        dom.password.value = config.password || '';
        dom.testUrl.value = config.testUrl || 'https://www.google.com';
        
        toggleFields();
        toggleAuthFields();
    } catch (e) {
        showResult('读取配置失败: ' + e.message, 'error');
    }
}

/**
 * 根据启用状态显示/隐藏主字段
 */
function toggleFields() {
    dom.proxyFields.style.opacity = dom.enabled.checked ? '1' : '0.5';
    dom.proxyFields.style.pointerEvents = dom.enabled.checked ? 'auto' : 'none';
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
    return {
        enabled: dom.enabled.checked,
        authEnabled: dom.authEnabled.checked,
        type: dom.type.value,
        host: dom.host.value.trim(),
        port: dom.port.value.trim(),
        username: dom.username.value.trim(),
        password: dom.password.value, // 密码不 trim
        testUrl: dom.testUrl.value.trim()
    };
}

// 绑定事件
dom.enabled.addEventListener('change', toggleFields);
dom.authEnabled.addEventListener('change', toggleAuthFields);

dom.btnTest.addEventListener('click', async () => {
    const data = getFormData();
    if (data.enabled && (!data.host || !data.port)) {
        showResult('请先填写代理地址和端口', 'error');
        return;
    }

    dom.btnTest.classList.add('btn-loading');
    dom.btnTest.disabled = true;
    showResult('加速测试中，请稍候...', 'success');

    try {
        const result = await _proxyAPI.testConnection(data);
        if (result.success) {
            showResult(`测试成功！响应时间: ${result.time}ms`, 'success');
        } else {
            showResult(`连接失败: ${result.error}`, 'error');
        }
    } catch (e) {
        showResult('系统错误: ' + e.message, 'error');
    } finally {
        dom.btnTest.classList.remove('btn-loading');
        dom.btnTest.disabled = false;
    }
});

dom.btnSave.addEventListener('click', async () => {
    const data = getFormData();
    
    // 如果启用了代理，校验必填项
    if (data.enabled) {
        if (!data.host || !data.port) {
            showResult('请完整填写代理地址和端口', 'error');
            return;
        }
        if (data.authEnabled && !data.username) {
            showResult('启用了认证但未填写用户名', 'error');
            return;
        }
    }

    try {
        const { password, ...config } = data;
        await _proxyAPI.saveProxyConfig(config, password);
        showResult('配置已成功保存', 'success');
        
        // 延迟关闭，让用户看到成功提示
        setTimeout(() => {
           _proxyAPI.closePanel();
        }, 800);
    } catch (e) {
        showResult('保存失败: ' + e.message, 'error');
    }
});

dom.btnCancel.addEventListener('click', () => {
    _proxyAPI.closePanel();
});

dom.backToDict.addEventListener('click', (e) => {
    e.preventDefault();
    _proxyAPI.closePanel();
});

// 初始化
loadConfig();
