# 设计文档：代理配置增加“关闭证书校验”选项

## 1. 背景与目标
在连接代理服务器下载离线词典时，部分代理服务器（如 Charles, Fiddler 或开启了 SSL 检查的 Clash）会使用自签名证书拦截 HTTPS 流量。这会导致 Node.js 的请求模块（如 `https` 或 `node-fetch`）报错 `self signed certificate`。

本设计的目标是在全局代理设置页面增加一个“关闭证书校验”的选项，允许用户在遇到此类问题时通过禁用证书验证来完成下载。

## 2. 设计方案

### 2.1 数据模型 (Data Model)
在 `app_config.js` 的 `proxy` 对象中增加字段：
- `sslVerify`: 布尔值，默认为 `false`。

```javascript
// APP_CONFIG_DEFAULTS 修改示意
proxy: {
  enabled: false,
  authEnabled: false,
  type: 'http',
  host: '',
  port: '',
  username: '',
  testUrl: 'https://www.google.com',
  sslVerify: false // 新增字段：是否校验 SSL 证书 (默认关闭)
}
```

### 2.2 用户界面 (UI)
在 `src/config/proxy-config.html` 中增加复选框：
- **位置**：放置在“开启代理认证”复选框的下方。
- **标签**：校验 SSL 证书 (若使用自签名证书代理，请关闭此项)。
- **ID**: `proxy-ssl-verify`。

### 2.3 渲染逻辑 (UI Logic)
修改 `src/config/proxy-renderer.js`：
- `dom` 对象增加对 `sslVerify` 复选框的引用。
- `loadConfig` 函数：加载并设置复选框状态。
- `getFormData` 函数：收集复选框状态。
- `performSave` 函数：确保该字段被正确保存到应用配置中。

### 2.4 核心代理服务 (Core Service)
修改 `src/core/proxy_service.js` 的 `testConnection` 方法：
- 在创建 `HttpsProxyAgent` 时，传递配置选项：
  ```javascript
  agent = new HttpsProxyAgent(proxyUrl, { 
    rejectUnauthorized: config.sslVerify 
  });
  ```

### 2.5 词典下载逻辑 (Backend Logic)
1.  **`src/backends/dict/index.js`**:
    - 在 `startDownload` 方法中，获取 `appConfig.load().proxy` 的完整对象。
    - 将 `sslVerify` 作为参数传递给 `downloadOptions`。

2.  **`src/backends/dict/downloader.js`**:
    - `DictDownloader` 构造函数增加对 `sslVerify` 的支持。
    - 在创建 `HttpsProxyAgent` 时应用该选项：
      ```javascript
      this.agent = new HttpsProxyAgent(this.proxy, { 
        rejectUnauthorized: options.sslVerify 
      });
      ```
    - 对于原生的 `https.request`，也可以通过在 `requestOptions` 中设置 `rejectUnauthorized: this.sslVerify` 来增强兼容性。

## 3. 安全性考虑
- 该选项默认关闭，仅在需要时建议开启。
- 在 UI 标签中通过说明提示其用途。

## 4. 测试计划
1.  **连通性测试**：在代理设置页面配置代理并取消勾选“校验 SSL 证书”，点击测试按钮，确保可以成功访问 HTTPS 地址。
2.  **离线词典下载**：在开启该选项的情况下，通过代理下载词典，确保不再报 `self signed certificate` 错误。
3.  **持久化测试**：关闭并重新打开配置页面，确保复选框状态正确保存。
