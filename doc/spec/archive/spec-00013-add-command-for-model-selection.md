## 核心需求
添加一条模型选择的斜线命令
触发词为 `model`，当前仅支持 `Helsinki-NLP` 选项。
每个模型选项需要在列表项下方用小字对其进行副标题描述，补充并描述其大概的翻译质量。

---

## 软件设计方案

### 1. 模块化组件扩展 (`commands/model.js`)
遵循上一期重构确立的 `Slash Command` 架构扩展规范，我们需要增加一个独立命令实现文件 `commands/model.js`。

**常量定义 (`MODELS` 集合)**
目前内部仅构建一个条目：
- `id`: `helsinki-nlp/opus-mt`
- `title`: `Helsinki-NLP (ONNX)`
- `description`: `当前内置基础模型。支持中英双向离线翻译。翻译质量：基础可用，适合简单字句和日常短句获取主干意思。`

*(为了更好的用户体验，可以额外增加一个灰色的、不可点击的占位或敬请期待项，如 `HY-MT1.5B (待支持)` 以表明后续演进方向。)*

**接口实现**
- `handleSearch(subInput, callback)`: 实现列表渲染组装，返回携带副标题/小字的模型集合数据，给选项标记上 `isCommandContext: true, commandTrigger: 'model', modelId: model.id`。同时需支持后接空格进行简单的模糊匹配（fuzzy search）。
- `handleSelect(itemData, appConfig)`: 当用户点选 `Helsinki-NLP` 时，修改或向用户的 `appConfig` 中保存所选模型 ID (可新增 `appConfig.backends.selected_model = itemData.modelId`)，将数据通过 `dbStorage` 持久化，并向底层网关抛出组合控制信号 `{ reloadBackend: true, restoreSearch: true }`，从而无缝切换翻译计算管线。

### 2. 命令中心注册 (`commands/index.js`)
在 `commands/index.js` 统一路由注册表中，引入 `model.js`：
```javascript
const modelCommand = require('./model.js');
const COMMANDS = [
  modeCommand,
  modelCommand
];
```
由于 `preload.js` 的所有转发都已经完全下放给 `CommandManager`，因此整个 uTools 按键监听机制无需做任何额外修改，`/model` 命令会自动享有防抖挂起、自动查词恢复等所有基础特性。

### 3. 配置持久化与引擎关联
由于用户在插件后台配置中可以拥有多个离线大模型选项（如未来接入了其他 ONNX 模型），本处命令的主要作用是将用户的选择落盘为当前“活动的（Active）”大模型。
如果当前使用的模式 (`/mode`) 本身不在“离线大模型”下（而处于离线词典），本命令（`/model`）应在记录之后静默挂起。若用户当前正在使用大模型翻译模式，切换 `/model` 后需要利用 `reloadBackend` 通知 `preload.js` 内的 `window.stopLocalWorker()` 即刻杀掉原模型 Worker 重新加载目标模型。

## 验收标准
1. 在输入栏键入 `/m` 或 `/model` 时即可联想出 `选择翻译模型` 根命令。
2. 回车/点击 `/model ` 后，可展示 `Helsinki-NLP` 并附带质量与性能说明的副标题。
3. 选择 `Helsinki-NLP` 后，界面自动消失下拉栏，若此前输入框有查询词语则能自动恢复单词并拉起后台翻译。