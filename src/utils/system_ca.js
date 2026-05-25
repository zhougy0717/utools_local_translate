const child_process = require('child_process');
const tls = require('tls');

let cachedCerts = null;

/**
 * 提取 macOS 系统钥匙串中的所有 PEM 格式证书
 * @returns {string[]}
 */
function extractMacOSCerts() {
  try {
    // -a: 查找所有证书, -p: 以 PEM 格式输出
    // 不指定具体 keychain 时，默认搜索系统配置的 keychain 搜索列表，包含 login.keychain 和 System.keychain
    const stdout = child_process.execSync('security find-certificate -a -p', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'] // 忽略 stderr 以免静默警告报错
    });
    return parsePEMs(stdout);
  } catch (e) {
    console.warn('[SystemCA] 无法提取 macOS 系统证书:', e.message);
    return [];
  }
}

/**
 * 提取 Windows 证书管理器中的所有根证书并导出为 PEM 格式
 * @returns {string[]}
 */
function extractWindowsCerts() {
  try {
    // 通过 PowerShell 提取 LocalMachine 和 CurrentUser 的 Root 证书，并导出为 Base64 后按 64 字符进行 PEM 格式分行排版
    const cmd = 'powershell -NoProfile -Command "Get-ChildItem -Path Cert:\\LocalMachine\\Root, Cert:\\CurrentUser\\Root | ForEach-Object { write-output -----BEGIN CERTIFICATE-----; [System.Convert]::ToBase64String($_.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)) -replace \'.{64}\', \\\"$&`r`n\\\" | Write-Output; write-output -----END CERTIFICATE----- }"';
    const stdout = child_process.execSync(cmd, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
    return parsePEMs(stdout);
  } catch (e) {
    console.warn('[SystemCA] 无法提取 Windows 系统证书:', e.message);
    return [];
  }
}

/**
 * 解析包含多个 PEM 证书的字符串
 * @param {string} rawData 
 * @returns {string[]}
 */
function parsePEMs(rawData) {
  const certs = [];
  if (!rawData) return certs;
  
  const regex = /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g;
  let match;
  while ((match = regex.exec(rawData)) !== null) {
    const cert = match[0].trim();
    if (cert) {
      certs.push(cert);
    }
  }
  return certs;
}

/**
 * 清除内存缓存（主要用于单元测试）
 */
function clearCache() {
  cachedCerts = null;
}

/**
 * 获取系统受信任证书列表，并与 Node.js 默认的根证书库合并
 * @returns {string[]}
 */
function getSystemCerts() {
  if (cachedCerts !== null) {
    return cachedCerts;
  }

  const defaultCerts = tls.rootCertificates || [];
  let systemCerts = [];

  if (process.platform === 'darwin') {
    systemCerts = extractMacOSCerts();
  } else if (process.platform === 'win32') {
    systemCerts = extractWindowsCerts();
  }

  // 过滤可能的重复证书并进行拼接合并
  const allCertsMap = new Map();
  
  // 先载入默认 Mozilla 根证书
  defaultCerts.forEach(cert => {
    allCertsMap.set(cert, cert);
  });
  
  // 再追加系统证书
  systemCerts.forEach(cert => {
    allCertsMap.set(cert, cert);
  });

  cachedCerts = Array.from(allCertsMap.values());
  return cachedCerts;
}

module.exports = {
  getSystemCerts,
  clearCache
};
