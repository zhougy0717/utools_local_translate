将ecdict backend改名为dict backend，并放入backends/dict目录中,包括ecdict.js
删除首次解压ecdict.db.gz的逻辑，改为直接使用配置的资源路径，如果资源路径没有配置，则使用resources目录下的ecdict.db和cccedict.db

## 软件方案

### 1. 目录与文件重构
- **新建目录**：创建 `backends/dict/` 目录。
- **文件迁移与重命名**：将 `backends/ecdict.js` 移动到 `backends/dict/index.js`（或保持 `dict.js`），并重命名相关导出方法，例如将 `createEcdictBackend` 重命名为 `createDictBackend`，使命名真正契合"dict backend"。
- **依赖更新**：在 `preload.js`及相关测试文件（如 `test/ecdict.test.js`）中，将原来引入 `'./backends/ecdict.js'` 的路径修改为 `'./backends/dict/index.js'`。

### 2. 数据库读取逻辑修改
- **移除解压逻辑**：移除原文件中的 `zlib` 引入以及 `ensureDbFromGz` 函数，去掉 `.db.gz` 文件的首次使用解压和删除逻辑。
- **支持配置路径**：
  在 `createDictBackend(options)` 初始化时，优先检查 `options.dictRepoPath`（或通过配置项全局读取的离线词典下载目录）。
  如果配置了该路径，则分别拼接出对应的数据库路径（如 `${dictRepoPath}/ecdict.db` 和 `${dictRepoPath}/cccedict.db`）。
- **保留兜底逻辑**：如果资源路径未配置或传入为空，则继续回退使用插件自带的路径：`path.join(__dirname, '../../resources/ecdict.db')` 和 `path.join(__dirname, '../../resources/cccedict.db')`。

### 3. 配置与UI交互对接
- **读取用户配置**：在 `preload.js` 中创建 `dict` backend 实例时，需要从数据库（如 `utools.db`）读取用户设置的离线词典目录（对应配置页面的存储方案）。
- **传递配置变更**：当用户在配置页面更改了词库包的存储路径，可以通过重新初始化或者动态设置参数的方式，使得后续的查词请求使用最新的词典路径。

### 4. 开发计划
- **第 1 步：目录与文件重构**
  - 创建 `backends/dict` 文件夹。
  - 移动 `backends/ecdict.js` 至 `backends/dict/index.js`。
  - 重命名文件内部的 `createEcdictBackend` 为 `createDictBackend`。
  - 修改 `preload.js`、`test/ecdict.test.js` 等所有引用该文件的路径。
- **第 2 步：数据库读取逻辑更新**
  - 移除 `index.js` 中的 `zlib` 依赖及 `.db.gz` 的首次解压逻辑。
  - 调整 `createDictBackend` 的入参，支持传入 `dictRepoPath`。
  - 更新数据库路径的获取逻辑：优先使用 `dictRepoPath`，未配置时则退回使用原本的 `resources` 目录。
- **第 3 步：全局配置注入**
  - 修改 `preload.js`，在创建 `dict backend` 时注入离线词典存储目录配置。
- **第 4 步：测试与验证**
  - 重命名并修复已有的单元测试（例如将 `ecdict.test.js` 更新为 `dict.test.js`）。
  - 执行 `node test/dict.test.js`，确保查询与路径回退逻辑都能通过测试。
