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
    btnBack: document.getElementById('btn-back'),
    resultMessage: document.getElementById('result-message'),
    proxyFields: document.getElementById('proxy-fields'),
    authFields: document.getElementById('auth-fields'),
    sslVerify: document.getElementById('proxy-ssl-verify')
};

// 表单 Dirty 状态追踪（任意字段修改后标记为 true，保存成功后重置）
let isDirty = false;

/**
 * 加载当前配置，并根据来源面板 ID 决定是否显示返回按钮
 */
async function loadConfig() {
    try {
        const config = await _proxyAPI.getProxyConfig();
        dom.authEnabled.checked = !!config.authEnabled;
        dom.sslVerify.checked = config.sslVerify === false;
        dom.type.value = config.type || 'http';
        dom.host.value = config.host || '';
        dom.port.value = config.port || '';
        dom.username.value = config.username || '';
        dom.password.value = config.password || '';
        dom.testUrl.value = config.testUrl || 'https://www.google.com';
        
        toggleAuthFields();

        // 查询来源面板 ID，非 null 时显示返回按钮
        const fromPanelId = _proxyAPI.getFromPanelId ? _proxyAPI.getFromPanelId() : null;
        if (fromPanelId && dom.btnBack) {
            dom.btnBack.style.display = '';
        }
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
        testUrl: dom.testUrl.value.trim(),
        sslVerify: !dom.sslVerify.checked
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
        // 保存成功后重置 dirty 状态
        isDirty = false;
        return true;
    } catch (e) {
        showResult('保存失败: ' + e.message, 'error');
        return false;
    }
}

// ─── Dirty 状态追踪：监听所有表单元素变动 ────────────────────────────────────
const watchedInputs = [dom.type, dom.host, dom.port, dom.username, dom.password, dom.testUrl];
watchedInputs.forEach(el => {
    if (!el) return;
    el.addEventListener('input', () => { isDirty = true; });
});
[dom.authEnabled, dom.sslVerify].forEach(el => {
    if (!el) return;
    el.addEventListener('change', () => { isDirty = true; });
});

// ─── 认证字段切换 ─────────────────────────────────────────────────────────────
dom.authEnabled.addEventListener('change', toggleAuthFields);

// ─── 返回按钮逻辑 ─────────────────────────────────────────────────────────────
if (dom.btnBack) {
    dom.btnBack.addEventListener('click', async () => {
        if (!isDirty) {
            // 表单未修改，直接返回
            _proxyAPI.goBack();
            return;
        }

        // 表单已修改，弹出 uTools 原生确认对话框
        const utools = window.parent && window.parent.utools ? window.parent.utools : (typeof window.utools !== 'undefined' ? window.utools : null);
        if (!utools) {
            // 降级：没有 utools API 时直接返回（测试环境）
            _proxyAPI.goBack();
            return;
        }

        const choice = await utools.showMessageBox({
            type: 'question',
            title: '未保存的更改',
            message: '你有未保存的修改，是否要保存后返回？',
            buttons: ['保存并返回', '直接返回 (丢弃修改)', '取消']
        });

        if (choice === 0) {
            // 保存并返回
            const saved = await performSave();
            if (saved) {
                _proxyAPI.goBack();
            }
            // 保存失败则留在当前页（performSave 已显示错误消息）
        } else if (choice === 1) {
            // 直接返回（丢弃修改）
            _proxyAPI.goBack();
        }
        // choice === 2：取消，停留在当前页
    });
}

// ─── 测试连通性按钮 ───────────────────────────────────────────────────────────
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
            // 注意：连接失败依然保留"配置已保存"的提示文字
            showResult(`配置已保存，但连接测试未通过: ${result.error}`, 'error');
        }
    } catch (e) {
        showResult('系统错误: ' + e.message, 'error');
    } finally {
        dom.btnTest.classList.remove('btn-loading');
        dom.btnTest.disabled = false;
    }
});

// ─── 保存按钮 ─────────────────────────────────────────────────────────────────
dom.btnSave.addEventListener('click', async () => {
    const saved = await performSave();
    if (saved) {
        showResult('配置已保存', 'success');
    }
});

// ─── Esc 键退出 ───────────────────────────────────────────────────────────────
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        _proxyAPI.closePanel();
    }
});

// 初始化
loadConfig();
