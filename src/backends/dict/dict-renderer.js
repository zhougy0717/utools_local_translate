const api = window.parent._dictAPI;

if (!api) {
  console.error('[Dict] window.parent._dictAPI not found');
  const errDiv = document.getElementById('errorMessage');
  if(errDiv) {
      errDiv.innerText = "内部错误：无法与主进程进行通信协商。";
      errDiv.style.display = 'block';
  }
}

const pathInput = document.getElementById('pathInput');
const btnBrowse = document.getElementById('btnBrowse');
const sourceSelect = document.getElementById('sourceSelect');
const btnDownload = document.getElementById('btnDownload');
const btnCancel = document.getElementById('btnCancel');
const progressBarContainer = document.getElementById('progressBarContainer');
const progressTitle = document.getElementById('progressTitle');
const progressStats = document.getElementById('progressStats');
const progressFill = document.getElementById('progressFill');
const progressMsg = document.getElementById('progressMsg');
const errorMessage = document.getElementById('errorMessage');
const linkProxy = document.getElementById('linkProxy');
const proxyToggle = document.getElementById('proxyToggle');
const proxyStatusLabel = document.getElementById('proxyStatusLabel');

// Initialize configuration and UI
if (api) {
  // 路径初始化
  const defaultDir = api.getDefaultDirectory();
  if (defaultDir) {
    pathInput.value = defaultDir;
  }

  // 代理开关初始化
  const config = api.getConfig();
  if (config && config.useProxy !== undefined) {
    proxyToggle.checked = config.useProxy;
    updateProxyUI(config.useProxy);
  }
}

function updateProxyUI(enabled) {
    proxyStatusLabel.textContent = enabled ? 'ON' : 'OFF';
    proxyStatusLabel.style.color = enabled ? '#166534' : '#64748b';
}

proxyToggle.onchange = () => {
    const enabled = proxyToggle.checked;
    updateProxyUI(enabled);
    if (api) {
        api.updateConfig({ useProxy: enabled });
    }
};

function setFormDisabled(disabled) {
  btnBrowse.disabled = disabled;
  sourceSelect.disabled = disabled;
  btnDownload.disabled = disabled;
  if(disabled) {
      btnCancel.disabled = true; // Disable cancel to avoid aborting halfway ungracefully
  } else {
      btnCancel.disabled = false;
  }
}

btnBrowse.onclick = () => {
  if (!api) return;
  const dir = api.chooseDirectory();
  if (dir) {
    pathInput.value = dir;
    errorMessage.style.display = 'none';
  }
};

if (linkProxy) {
  linkProxy.onclick = (e) => {
    e.preventDefault();
    if (api && typeof api.openProxyConfig === 'function') {
      api.openProxyConfig();
    }
  };
}

btnCancel.onclick = () => {
  if (api) api.closePanel();
};

btnDownload.onclick = async () => {
  const destDir = pathInput.value.trim();
  if (!destDir) {
    errorMessage.innerText = "请务必先选择数据存储目录";
    errorMessage.style.display = 'block';
    return;
  }
  
  errorMessage.style.display = 'none';
  setFormDisabled(true);
  progressBarContainer.style.display = 'block';
  
  const source = sourceSelect.value;
  
  progressTitle.innerText = "初始化下载环境...";
  progressStats.innerText = "0%";
  progressFill.style.width = "0%";
  progressFill.style.backgroundColor = "#0366d6";
  progressMsg.innerText = "正在连接服务器...";

  const result = await api.startDownload({ destDir, source }, (info) => {
    // info format: { phase, dict, percent, downloaded, total, message }
    
    // Display Phase logic
    let phaseText = info.phase === 'building' ? '解压构建' : '下载中';
    let dictText = info.dict === 'ecdict' ? 'ECDICT (英汉)' : 'CC-CEDICT (汉英)';
    progressTitle.innerText = `${phaseText}: ${dictText}`;
    
    // Percent
    const pct = isNaN(info.percent) ? 0 : Math.round(info.percent);
    progressStats.innerText = `${pct}%`;
    progressFill.style.width = `${pct}%`;
    
    // Message or Bytes
    if (info.message) {
      progressMsg.innerText = info.message;
    } else {
      const down = formatBytes(info.downloaded || 0);
      const tot = formatBytes(info.total || 0);
      if (tot !== '0 B') {
        progressMsg.innerText = `数据传送: ${down} / ${tot}`;
      } else {
         progressMsg.innerText = "传输中...";
      }
    }
  });

  if (result.success) {
    progressTitle.innerText = "部署完成！";
    progressStats.innerText = "100%";
    progressFill.style.width = "100%";
    progressFill.style.backgroundColor = "#2ea44f"; // Success green
    progressMsg.innerText = "即将重新加载以提供离线查词能力...";
    
    setTimeout(() => {
      api.closePanel();
    }, 1200);
  } else {
    // Show error
    errorMessage.innerText = `处理遭到异常中止: ${result.error?.message || String(result.error)}`;
    errorMessage.style.display = 'block';
    
    // Re-enable interface
    setFormDisabled(false);
    btnCancel.disabled = false;
    progressFill.style.backgroundColor = "#cb2431"; // Error red
    progressTitle.innerText = "操作中止";
  }
};

// 绑定 Esc 键退出
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
      if (api) api.closePanel();
  }
});

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
