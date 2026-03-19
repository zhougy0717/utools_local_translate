添加一条斜线命令，用于选择离线词典（模型）的路径
触发词为 `path`，当前支持：默认，自定义
当用户选择自定义后，弹出路径选择对话框，用户选择后记录路径，用于后续下载文件使用。

---

## 软件设计方案

### 1. 新增命令模块 (`commands/path.js`)
遵循现有的 `Slash Command` 架构扩展规范，新增 `commands/path.js`：

**选项定义 (`PATHS` 集合)**
提供两个选项：
- `default`: 默认路径（重置为空，走插件内部或者默认数据路径）。
- `custom`: 自定义路径（选择后唤起系统的文件夹选择弹窗）。

**接口实现**
- `handleSearch(subInput, callback)`: 组装返回“默认”和“自定义”列表项，可利用副标题展示当前的 `appConfig.resourcePath` 状态，标识附带 `isCommandContext: true, commandTrigger: 'path', pathAction: action`。支持后接空格进行输入字符的模糊过滤。
- `handleSelect(itemData, appConfig)`: 
  - 当 `pathAction === 'default'` 时：清空 `appConfig.resourcePath = ''`，利用 `utools.dbStorage.setItem` 持久化。
  - 当 `pathAction === 'custom'` 时：调用 uTools 的系统级原生接口 `utools.showOpenDialog({ title: "选择数据存储目录", properties: ["openDirectory"] })` 召唤该弹框。如果用户点击确认并选择了有效路径，则赋值 `appConfig.resourcePath = selectedPaths[0]` 并持久化；如果用户点击取消，则放弃更改，不触发后续操作。
  - 持久化成功后，返回边界控制信号 `{ reloadBackend: true, restoreSearch: true }`，下发给 `preload.js` 网关从而执行环境配置重载，并还原用户的查词框状态。

### 2. 路由中心挂载 (`commands/index.js`)
在 `commands/index.js` 统一路由注册集合中，引入 `path.js`：
```javascript
const pathCommand = require('./path.js');
const COMMANDS = [
  // ... 之前挂载的命令
  pathCommand
];
```
借由现有的 `CommandManager` 结构，只要注册进入数组，即可无缝支持预加载与回调拦截能力。

### 3. 验收标准
1. 在输入栏键入 `/p` 或 `/path` 时即可在主搜索列表中联想出 `存储路径` 根命令。
2. 回车补全后展开两个候选子项，且其中会用小字描述展示目前所处的真正路径指代情况。
3. 点击“自定义”，能正常出现本地 Windows 选取文件夹对话框。
4. 选择指定文件夹并确认后，数据库成功记录该配置，并在下一次底层检索时按照新路径挂载词典/模型资源。