# 实现计划 - 代理界面优化与模块化控制

本计划旨在根据 [Spec 00034](file:///c:/Users/Banny/code/local_translate/doc/spec/spec-00034-optimize-proxy-interface.md) 优化代理配置体验，并实现更灵活的按模块分流代理控制。

## 用户审核事项
> [!IMPORTANT]
> - **退出路径变更**：移除底部“取消/返回”按钮后，用户如果想直接退出，需点击 uTools 窗口外部或执行其他退出指令。
> - **全局开关失效**：全局 `proxy.enabled` 将在 UI 上消失。虽然底层逻辑会确保只要模块开启了代理开关且配置有效即可上网，但旧有的“一键关闭所有模块代理”的能力将被模块化开关取代。

## 方案细述

### 1. 配置层 (Config Layer)

#### [MODIFY] [app_config.js](file:///c:/Users/Banny/code/local_translate/src/utils/app_config.js)
- 调整 `getProxy()` 逻辑：不再单纯依赖 `p.enabled`。
- 修改为：即使 `p.enabled` 为 false，如果明确传入了强制启用参数（或模块自决），只要有 Host/Port 即可返回代理字符串。

#### [MODIFY] [dict/config.js](file:///c:/Users/Banny/code/local_translate/src/backends/dict/config.js)
- 在 `DICT_DEFAULTS` 中新增 `useProxy: false` 属性。

---

### 2. 代理设置 UI (Proxy Config UI)

#### [MODIFY] [proxy-config.html](file:///c:/Users/Banny/code/local_translate/src/config/proxy-config.html)
- 移除：顶部的 `proxy-enabled` 复选框区域。
- 移除：底部的 `.button-group` 和 `back-to-dict` 链接。
- 新增：在 `col-port` 旁边增加一个 `btn-save-inline` (✓ 按钮)。

#### [MODIFY] [proxy-style.css](file:///c:/Users/Banny/code/local_translate/src/config/proxy-style.css)
- 增加 `.btn-save-inline` 样式：32x32px 蓝色圆角按钮。
- 增加对第一行主配置区域的 Flex 布局微调，确保 Host/Port/Save 按钮完美对齐。

#### [MODIFY] [proxy-renderer.js](file:///c:/Users/Banny/code/local_translate/src/config/proxy-renderer.js)
- 移除对全局开关的初始化和监听逻辑。
- 绑定新的行内保存按钮，执行保存后调用 `_proxyAPI.closePanel()`。
- 确保保存时依然广播配置变更事件以触发后端热重载。

---

### 3. 离线词典配置 UI (Dict Config UI)

#### [MODIFY] [dict-config.html](file:///c:/Users/Banny/code/local_translate/src/backends/dict/dict-config.html)
- 引入 `toggle-switch` 相关 CSS 样式（从 Ollama 页面同步过来）。
- 在“下载节点”标签上方增加一行代理控制栏，包含图标、文本描述和开关。

#### [MODIFY] [dict-renderer.js](file:///c:/Users/Banny/code/local_translate/src/backends/dict/dict-renderer.js)
- 初始化时加载 `dictConfig.useProxy` 状态。
- 监听开关变化，通过 `api.updateConfig({ useProxy: val })` 实时保存。

---

## 验证计划

### 自动化/手动验证
- **UI 校验**：直接进入代理设置，确认界面变为单行紧凑模式。
- **保存功能**：修改 Port 后点击旁边的小勾，确认面板关闭且 uTools 数据库中的配置已更新。
- **配置联动**：
    1. 打开离线词典下载页面。
    2. 切换代理开关，查看控制台或通过测试手段确认后端收到了配置变更。
- **性能/状态**：
    - 开启代理下载，模拟下载流程。
    - 关闭代理下载，模拟直连下载流程。

### 回归测试
- 检查 Ollama 配置界面是否仍然正常，确保样式同步没有引起冲突。
