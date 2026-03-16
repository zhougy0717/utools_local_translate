---
name: auto-download-dict
overview: 实现离线词典自动下载功能，包括下载管理器、状态检测、自动下载流程和UI集成
todos:
  - id: update-package-json
    content: 更新 package.json 依赖：将 node-fetch 移至 dependencies，添加 https-proxy-agent
    status: completed
  - id: create-downloader
    content: 创建下载管理器：新建 src/backends/dict/downloader.js，实现 DictDownloader 类
    status: completed
    dependencies:
      - update-package-json
  - id: integrate-downloader
    content: 集成下载功能：修改 src/backends/dict/index.js，添加状态检测和下载触发接口
    status: completed
    dependencies:
      - create-downloader
  - id: extend-mode-command
    content: 扩展模式命令：修改 src/commands/mode.js，实现自动下载触发逻辑
    status: completed
    dependencies:
      - integrate-downloader
  - id: create-unit-test
    content: 创建单元测试：新建 test/dict_downloader.test.js
    status: completed
    dependencies:
      - create-downloader
  - id: run-tests
    content: 运行测试：执行 npm test 验证功能
    status: completed
    dependencies:
      - create-unit-test
---

## 需求概述

1. 当用户选择离线词典查词模式时，如果词典未下载（ecdict.db 或 cccedict.db 不存在），则自动触发下载流程
2. 如果用户已配置代理服务器（通过 /proxy 命令设置），下载词典时使用代理连接
3. 使用 node-fetch + https-proxy-agent 实现下载功能
4. 下载进度百分比使用小字（description 字段）在列表中显示

## 核心功能

- 下载管理器：支持 ECDICT 和 CC-CEDICT 词典下载，提供进度回调
- 状态检测：区分 READY、UNAVAILABLE、DOWNLOADING、DOWNLOADED_UNPROCESSED 等状态
- 自动触发：选择离线词典模式时自动检测并处理下载
- UI 进度展示：显示下载百分比和已下载/总大小

## 技术选型

- **HTTP 客户端**：node-fetch（项目已有，从 devDependencies 移至 dependencies）
- **代理支持**：https-proxy-agent（新增依赖）
- **测试框架**：Node.js 内置 node:test 模块（项目已有）

## 技术架构

### 模块划分

1. **下载管理器** (`src/backends/dict/downloader.js`) [NEW]

- 职责：管理词典文件下载，支持代理配置，提供进度回调
- 核心方法：`downloadEcdict(onProgress)`、`downloadCccedict(onProgress)`、`downloadFile(url, filename, onProgress)`

2. **词典后端** (`src/backends/dict/index.js`) [MODIFY]

- 职责：集成下载功能，检测词典状态，管理词典数据
- 扩展：添加状态检测方法和下载触发接口

3. **模式命令** (`src/commands/mode.js`) [MODIFY]

- 职责：扩展模式选择逻辑，触发自动下载流程
- 修改：`handleSelect` 方法增加下载状态处理分支

### 数据流程

```
用户选择离线词典 → 检测词典状态 → 
  [UNAVAILABLE] 询问用户确认 → 启动下载 → 解压转换 → 切换模式
  [DOWNLOADING] 显示当前进度 → 等待完成
  [READY] 直接切换模式
```

### 关键实现细节

1. **进度计算**：通过读取 HTTP Content-Length 头和流式读取响应体实时计算
2. **代理配置**：从 appConfig.proxy 读取，传递给 https-proxy-agent
3. **下载源**：

- ECDICT: GitHub Releases
- CC-CEDICT: MDBG