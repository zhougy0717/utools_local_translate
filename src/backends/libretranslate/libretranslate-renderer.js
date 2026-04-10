(function() {
    const $ = id => document.getElementById(id);
    
    const apiBaseInput = $('apiBase');
    const apiKeyInput = $('apiKey');
    const sourceLangSelect = $('sourceLang');
    const targetLangSelect = $('targetLang');
    const useProxyCheckbox = $('useProxy');
    const proxyLabel = $('proxy-label');
    const btnSave = $('btn-save');
    const btnRefreshLangs = $('btn-refresh-langs');
    const statusDot = $('status-dot');
    const statusText = $('status-text');
    const testMessage = $('test-message');

    // 状态更新方法
    function setStatus(state, message) {
        statusDot.className = 'status-dot ' + state;
        statusText.innerText = message;
    }

    // 显示测试结果
    function showMessage(isSuccess, message) {
        testMessage.innerText = message;
        testMessage.className = isSuccess ? 'msg-success' : 'msg-error';
        testMessage.style.display = 'block';
        setTimeout(() => {
            testMessage.style.display = 'none';
        }, 5000);
    }

    // 加载语言列表
    function updateLanguageDropdowns(languages) {
        if (!languages || !Array.isArray(languages)) return;
        
        const currentSource = sourceLangSelect.value;
        const currentTarget = targetLangSelect.value;

        // 清空除默认项以外的选项
        sourceLangSelect.innerHTML = '<option value="auto">自动检测 (Auto Detect)</option>';
        targetLangSelect.innerHTML = '';

        languages.forEach(lang => {
            const name = lang.name || lang.code;
            const code = lang.code;
            
            const opt1 = document.createElement('option');
            opt1.value = code;
            opt1.innerText = `${name} (${code})`;
            sourceLangSelect.appendChild(opt1);

            const opt2 = document.createElement('option');
            opt2.value = code;
            opt2.innerText = `${name} (${code})`;
            targetLangSelect.appendChild(opt2);
        });

        if (currentSource) sourceLangSelect.value = currentSource;
        if (currentTarget) targetLangSelect.value = currentTarget;
    }

    // 执行测试逻辑
    async function performCheck(isSilent = false) {
        if (!isSilent) setStatus('loading', '连接中...');
        
        const apiBase = apiBaseInput.value.trim();
        const apiKey = apiKeyInput.value.trim();

        if (!apiBase) {
            setStatus('offline', '未配置地址');
            return;
        }

        const result = await window._libreAPI.testConnection(apiBase, apiKey);
        
        if (result.success) {
            setStatus('online', '已联通');
            updateLanguageDropdowns(result.languages);
            return true;
        } else {
            setStatus('offline', '连接失败');
            if (!isSilent) showMessage(false, `连接错误: ${result.message}`);
            return false;
        }
    }

    // 初始化配置
    function init() {
        if (!window._libreAPI) return;

        const config = window._libreAPI.loadConfig();
        apiBaseInput.value = config.apiBase || 'http://127.0.0.1:5000';
        apiKeyInput.value = config.apiKey || '';
        sourceLangSelect.value = config.sourceLang || 'auto';
        targetLangSelect.value = config.targetLang || 'zh';
        useProxyCheckbox.checked = !!config.useProxy;
        updateProxyLabel(!!config.useProxy);

        // 自动尝试一次健康检查
        performCheck(true);
    }

    function updateProxyLabel(active) {
        proxyLabel.innerText = active ? 'ON' : 'OFF';
        proxyLabel.className = active ? 'proxy-status-tag active' : 'proxy-status-tag';
    }

    useProxyCheckbox.onchange = (e) => {
        updateProxyLabel(e.target.checked);
    };

    $('btn-config-proxy').onclick = (e) => {
        e.preventDefault();
        // 如果有全局配置代理的方法，可以调用
        if (typeof utools !== 'undefined') {
            // 这里假设通过 coreService 触发，或由后端自行处理
            // 为简单起见，提示用户退出配置去全局设置
            showMessage(true, '请在插件设置中配置全局代理');
        }
    };

    // 绑定事件
    btnSave.onclick = async () => {
        const config = {
            apiBase: apiBaseInput.value.trim(),
            apiKey: apiKeyInput.value.trim(),
            sourceLang: sourceLangSelect.value,
            targetLang: targetLangSelect.value,
            useProxy: useProxyCheckbox.checked
        };

        const result = window._libreAPI.saveConfig(config);
        if (result.success) {
            const isOnline = await performCheck(false);
            if (isOnline) {
                btnSave.innerText = '✅';
                setTimeout(() => {
                    btnSave.innerText = '✔️';
                }, 1500);
            }
        }
    };

    btnRefreshLangs.onclick = () => performCheck(false);

    // ESC 退出
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            window._libreAPI.closePanel();
        }
    }, true);

    // 启动
    init();
})();
