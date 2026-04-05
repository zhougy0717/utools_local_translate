# Spec-00033: 增加离线词典切换确认二级菜单 (Offline Dict Mode Confirmation Sub-menu)

## 1. 背景 (Background)
目前插件在 `/mode` 指令下切换翻译模式时，Ollama 模式采用的是“二级确认”逻辑（点击后显示“确认启用”和“打开配置”两个选项），而“离线词典”模式在数据就绪时会直接切换。为了提升交互的一致性，减少误触，并为离线词典提供一个快速跳转到配置页面的入口，需要为离线词典也实现类似的二级菜单。

## 2. 目标 (Goals)
*   **交互一致性**：使离线词典的切换流程与 Ollama 模式完全对称。
*   **功能可达性**：在模式选择界面提供直接打开“离线词典配置面板”的入口。
*   **视觉对齐**：遵循 `spec-00032` 确定的视觉规范和图标使用建议。

## 3. 详细设计 (Detailed Design)

### 3.1 二级菜单结构
当用户在 `/mode` 列表中选择“离线词典”项时，触发二级菜单展示。

| 菜单项 | 标题 (Title) | 描述 (Description) | 动作 (Action) |
| :--- | :--- | :--- | :--- |
| **确认选项** | `确认启用离线词典翻译模式` | `当前状态: ${statusText}` (例如：✅ 数据已就绪) | `confirm_dict` |
| **配置选项** | `打开离线词典配置面板` | `⚙️ 管理词典数据与下载状态` | `open_dict_config` |

### 3.2 逻辑处理 (`src/commands/mode.js`)

#### A. 拦截一级点击
在 `handleSelect` 函数中，检查 `itemData.modeId === 'offline_dict'`。如果当前项没有 `action` 属性，则通过 `callbackSetList` 渲染上述二级子菜单，并返回 `{ disableClear: true }` 以保持列表展开。

#### B. 处理二级动作
*   **`confirm_dict`**: 
    1. 修改 `appConfig.backends`，将 `offline_dict` 设为 `true`，其他设为 `false`。
    2. 执行 `utools.dbStorage.setItem('app_config', appConfig)` 持久化。
    3. 返回 `{ reloadBackend: true, restoreSearch: true }` 以应用更改并回到翻译界面。
*   **`open_dict_config`**:
    1. 同上，先切换活跃 Backend 为 `offline_dict`。
    2. 返回 `{ openConfigPanel: true, reloadBackend: true }` 以唤起内嵌的 `dict-config.html` 面板。

### 3.3 视觉优化
*   使用 `src/commands/icons.js` 中定义的图标（如 `Icons.DICT`）。
*   状态描述（如 ✅ ⚠️）应与一级列表保持一致，确保信息传达的准确性。

## 4. 验收标准 (Acceptance Criteria)
*   [x] 点击 `/mode` 中的“离线词典”后，不会立即切换，而是展开两个子选项。
*   [x] 子选项的文案风格（如“确认启用...翻译模式”）与 Ollama 模式保持 100% 一致。
*   [x] 点击“确认启用”后，翻译模式成功切换并重载后端。
*   [x] 点击“打开词典配置面板”后，能够正确弹出词典管理 UI。
