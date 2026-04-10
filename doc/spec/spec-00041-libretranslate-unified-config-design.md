# Spec-00041: LibreTranslate 可视化配置与交互统一设计

## 1. 背景与动机
目前 LibreTranslate 后端的配置主要依赖于 `/libre <url> [key]` 指令，缺乏直观的可视化界面。为了提升用户体验，并使所有翻译后端的交互逻辑保持一致（对齐 Ollama 和离线词典），我们需要为 LibreTranslate 实现配套的配置面板及二级确认菜单流程。

## 2. 设计目标
- **交互对齐**：在 `/mode` 命令中点击 LibreTranslate 时，展示“确认启用”与“配置面板”二级菜单。
- **可视化配置**：提供包含状态检测、API 参数设置、语言偏好设置、网络代理集成的配置页面。
- **配置持久化**：支持设置默认的源语言（默认为自动检测）和目标语言（默认为简体中文）。

## 3. 详细方案

### 3.1 交互流程更新 (Command Layer)
修改 `src/commands/mode.js`：
- 当用户选择 `libretranslate` 模式时，不再直接切换。
- 展示子菜单：
  1. **确认启用 LibreTranslate 翻译模式**：点击后切换后端并重载。
  2. **打开 LibreTranslate 配置面板**：点击后弹出可视化设置窗口。

### 3.2 可视化配置面板 (UI Layer)
新建以下文件：
- `src/backends/libretranslate/libretranslate-config.html`
- `src/backends/libretranslate/libretranslate-renderer.js`

#### 3.2.1 界面原型 (UI Prototype)

<br/>

<table width="100%" style="border-collapse: collapse; border: 1px solid #e1e4e8; font-family: -apple-system, system-ui, sans-serif; border-radius: 8px; overflow: hidden;">
    <tr style="background-color: #f6f8fa;">
        <td style="padding: 15px; border-bottom: 1px solid #e1e4e8;">
            <b style="font-size: 16px; color: #24292e;">LibreTranslate 配置</b>
            <span style="font-size: 12px; color: #2ea44f; margin-left: 8px;">● 已联通 (v1.5.0)</span>
        </td>
    </tr>
    <tr>
        <td style="padding: 20px;">
            <div style="font-size: 11px; font-weight: 700; color: #6a737d; margin-bottom: 12px;">接口与凭据</div>
            <table width="100%" style="border-collapse: collapse;">
                <tr>
                    <td style="padding-bottom: 12px; padding-right: 10px;">
                        <div style="font-size: 12px; font-weight: 600; margin-bottom: 4px;">API Base URL</div>
                        <div style="padding: 6px 10px; border: 1px solid #d1d5da; background: #fafbfc; border-radius: 4px; font-size: 13px; color: #24292e;">https://translate.libretranslate.com</div>
                    </td>
                    <td style="padding-bottom: 12px;">
                        <div style="font-size: 12px; font-weight: 600; margin-bottom: 4px;">API Key (可选)</div>
                        <div style="padding: 6px 10px; border: 1px solid #d1d5da; background: #fafbfc; border-radius: 4px; font-size: 13px; color: #24292e;">••••••••••••</div>
                    </td>
                </tr>
                <tr>
                    <td style="padding-right: 10px;">
                        <div style="font-size: 12px; font-weight: 600; margin-bottom: 4px;">源语言 (Source)</div>
                        <div style="padding: 6px 10px; border: 1px solid #d1d5da; background: #fafbfc; border-radius: 4px; font-size: 13px; color: #24292e;">自动检测 ▾</div>
                    </td>
                    <td>
                        <div style="font-size: 12px; font-weight: 600; margin-bottom: 4px;">目标语言 (Target)</div>
                        <div style="padding: 6px 10px; border: 1px solid #d1d5da; background: #fafbfc; border-radius: 4px; font-size: 13px; color: #24292e;">简体中文 ▾</div>
                    </td>
                </tr>
            </table>
        </td>
    </tr>
    <tr>
        <td style="padding: 0 20px 20px 20px;">
            <div style="background-color: #f1f8ff; border: 1px solid #c8e1ff; border-radius: 6px; padding: 12px; display: table; width: 100%;">
                <div style="display: table-cell; vertical-align: middle; width: 40px; font-size: 20px;">🌐</div>
                <div style="display: table-cell; vertical-align: middle;">
                    <b style="color: #0366d6; font-size: 13px;">网络和代理分流</b><br/>
                    <span style="font-size: 12px; color: #586069;">开启后将通过全局代理服务器转发所有翻译请求。</span>
                </div>
                <div style="display: table-cell; vertical-align: middle; text-align: right; width: 60px;">
                    <div style="display: inline-block; width: 34px; height: 18px; background: #2ea44f; border-radius: 10px; position: relative;">
                        <div style="width: 14px; height: 14px; background: #fff; border-radius: 50%; position: absolute; right: 2px; top: 2px;"></div>
                    </div>
                </div>
            </div>
        </td>
    </tr>
    <tr>
        <td style="padding: 15px; background: #f6f8fa; text-align: right; border-top: 1px solid #e1e4e8;">
            <div style="display: inline-block; padding: 6px 12px; border: 1px solid #d1d5da; background: #fff; border-radius: 6px; font-size: 12px; font-weight: 600; color: #24292e; margin-right: 8px; cursor: pointer;">测试</div>
            <div style="display: inline-block; padding: 6px 16px; background: #2ea44f; color: #fff; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;">保存并关闭</div>
        </td>
    </tr>
</table>

<br/>


**功能模块设计**：
1. **状态栏**：
   - 实时显示连接状态（在线/离线/检查中）。
   - 显示当前使用的服务器版本（如果有）。
2. **接口与凭据**：
   - `API Base URL` 输入框。
   - `API Key` 输入框（隐藏输入）。
3. **语言偏好**：
   - `默认源语言` 下拉框（选项包括“自动检测”及受支持的语言）。
   - `默认目标语言` 下拉框（预设为简体中文）。
4. **网络设置**：
   - 代理开关卡片，集成全局代理设置链接。
5. **底部操作栏**：
   - `测试连接` 按钮：验证 API 可用性。
   - `保存配置` 按钮：持久化设置并重载后端。

### 3.3 后端适配 (Backend Layer)
修改 `src/backends/libretranslate/index.js`：
- 实现 `openConfigPanel(onCloseCallback)`：加载配置 HTML 并将其推送到 uTools 视图中。
- 实现 `closePanel(isSilent)`：清理正在显示的面板。

修改 `src/backends/libretranslate/config.js`：
- 扩展配置数据模型，增加 `sourceLang` (默认 `auto`) 和 `targetLang` (默认 `zh`) 字段。

## 4. 关键文件变更
- `preload.js`: 确保面板清理逻辑覆盖新容器 ID。
- `src/core/backend_manager.js`: 增加对 LibreTranslate 配置容器的识别。
- `src/commands/mode.js`: 注入二级菜单逻辑。

## 5. 测试设计 (Test Design)

### 5.1 单元测试 (Unit Tests)
测试文件：`test/libretranslate_backend.test.js`
- **配置持久化测试**：
    - 验证 `ConfigManager` 能正确保存和读取 `sourceLang` 和 `targetLang` 字段。
    - 验证当字段缺失时，能够正确回退到默认值 (`auto` / `zh`)。
- **请求构造测试**：
    - 验证当用户选择不同源语言时，发送给 API 的数据包中 `source` 字段是否匹配。
    - 验证 API Key 为空时，Headers 中不包含 Authorization 字段。

### 5.2 Mock 接口测试 (Mocking)
使用 `nock` 模拟服务器响应：
- **正常流程**：模拟 `/translate` 返回标准 JSON 结果。
- **语言列表获取**：模拟 `/languages` 返回数组，验证配置页面的下拉菜单是否能正确解析并渲染。
- **网络异常**：模拟 500 错误或超时，验证前端状态栏是否能正确显示“离线”状态及错误提示。

### 5.3 集成与交互测试 (Integration / UI Bridge)
- **子菜单触发**：在 `mode.js` 的测试用例中，模拟点击 LibreTranslate 检查是否返回了预期的二级菜单指令项。
- **Bridge 回调逻辑**：测试 `window._libreAPI.closePanel` 被调用时，`document` 中对应的容器 ID 是否被移除。
- **生命周期清理**：验证在查词过程中点击配置面板，当前的 Workers 是否已被正确停止。

## 6. 验收标准
1. 通过 `/mode` 切换到 LibreTranslate 时会看到二级菜单。
2. 配置面板能够成功保存配置，并根据保存内容实时重载翻译引擎。
3. 点击“测试连接”能正确反馈服务器的可访问性。
4. 翻译结果遵循配置页中的默认语言设置。
