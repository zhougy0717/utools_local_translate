# Spec-00026: 重构离线词典配置交互为弹出式 UI

## 1. 背景与目标 (Objective)
当前离线词典（`offline_dict`）在未就绪时，通过 uTools 列表项（`setList`）引导用户配置路径或下载，交互较为零碎。
本重构旨在提供类似 Ollama 模式的 **弹出式配置面板**，使用户能够在专门的 UI 中一站式完成：
1. 配置数据存放目录。
2. 选择下载源（GitHub/Gitee）。
3. 实时查看下载与构建进度。

## 2. 交互流程 (User Interaction)
1. **触发触发**：用户输入 `/mode` 并选择 `离线词典`。
2. **状态检测**：如果离线词典状态不是 `READY`：
   - 不再返回指令列表项。
   - 自动弹出“离线词典配置”全屏面板。
3. **面板操作**：
   - **路径选择**：显示当前路径，点击“浏览”打开系统文件夹选择器。
   - **下载源选择**：下拉选择“Gitee (国内推荐)”或“GitHub (标准)”。
   - **开始下载**：点击按钮开始，下方实时显示进度条和详细状态。
   - **完成自动关闭**：下载并构建完成后，界面提示成功并自动关闭。
4. **即刻使用**：面板关闭后，后端自动重载，用户可直接输入单词查词。

## 3. 设计细节 (Design Details)

### 3.1 后端扩展 (`src/backends/dict/index.js`)
- 增加 `openConfigPanel(onCloseCallback)` 方法。
- 功能：创建全屏 `iframe` 容器，加载 `dict-config.html`，并暴露关闭方法。

### 3.2 UI 组件 (`src/backends/dict/`)
- **`dict-config.html`**:
  - 使用 Vanilla CSS 构建。
  - 包含路径文本框、浏览按钮、源下拉框、开始按钮、进度条容器。
- **`dict-renderer.js`**:
  - 负责与父窗口（`preload.js`）通信。
  - 调用 `utools.showOpenDialog` 选择目录。
  - 监听下载/构建进度并更新进度条。

### 3.3 命令层修改 (`src/commands/mode.js`)
- 修改 `handleSelect`：当 `modeId === 'offline_dict'` 且状态不为 `READY` 时，返回信号 `{ openDictConfig: true }`。

### 3.4 预加载层修改 (`preload.js`)
- 修改 `select` 回调：识别 `openDictConfig` 信号并调用 `BackendManager.openDictConfig()`。

## 4. 技术实现难点 (Implementation Notes)
- **文件系统访问**：Iframe 内部无法直接调用 `fs`。需通过 `window.parent` 调用 `preload.js` 暴露的下载函数。
- **进度中转**：`DictDownloader` 的进度回调需要通过跨窗口通讯传递给渲染进程。
- **UI 美化**：遵循现代极简设计风格，使用 HSL 配色和圆角设计，确保 premium 感。

## 5. 验收标准 (Success Criteria)
1. `/mode` 选择离线词典，若未下载则能自动弹窗。
2. 弹窗中能正确打开文件夹选择对话框并更新配置。
3. 下载进度条能平滑更新，没有死锁或白屏。
4. 完成后能自动切回查词状态。
