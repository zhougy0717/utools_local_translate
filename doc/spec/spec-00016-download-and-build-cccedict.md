当用户配置的词典目录缺少cccedict词典文件时，在选择模型时显示：缺少词典文件，请自行下载
用户需从[MDBG Chinese Dictionary](https://www.mdbg.net/chinese/dictionary?page=cedict)下载cedict_1_0_ts_utf-8_mdbg.zip，并放入指定目录
当用户配置的词典目录包含cedict_1_0_ts_utf-8_mdbg.zip文件时，对该文件进行解压，并生成可用sqlite数据库
在生成数据库时，需使用百分比显示转换的进度

## 软件方案设计

### 1. 状态检测与提示 (`commands/mode.js` & 查词主入口)
*   **状态检测扩展**: 修改 `getDictStatus` 函数，综合判断 `ecdict` 和 `cccedict` 双方的资源准备情况。
    根据 ecdict 和 cccedict 的状态，离线词典模式的资源下载情况说明需调整为：
    1. 如果两个词典的数据都不存在，显示：(词典未下载)
    2. 如果只有一个词典的数据，另一个词典不存在，则显示：(词典数据不完整)
    3. 如果两个词典的数据都存在，但其中一个是压缩包，则显示：(数据已下载，未转换)
    4. 如果两个词典的 sqlite 数据都已经生成，则显示：(数据已就绪)
*   **交互逻辑说明**: 在 `handleSelect` 中依据新状态给予对应操作引导（指引下载补全或者将压缩包解压转制数据库）。如果在“词典数据不完整”状态下，对应工作目录中存在任一词典的 zip 包，也应在此操作中一并解压转换并反馈相应的进度。
*   **查词操作联动 (单语种状态解耦)**: 当配置的 backend 为 `dict`（离线词典模式）时，在执行实际查词前检查对应查词语种的数据就绪情况。若英文查中文，则**只关注** ecdict 的状态；若中文查英文，则**只关注** cccedict 的状态：
    *   **查英文单词 (`ecdict`)**:
        *   如果 ecdict 数据未就绪但对应压缩包已下载，尝试查词时直接触发词典的后台构建，并向列表下发同步进度，构建完成后自动恢复当前查询。
        *   如果 ecdict 词典完全未下载，提示用户下载相关的 ecdict 词典数据，不再关注 cccedict 是否存在。
    *   **查中文词汇 (`cccedict`)**:
        *   如果 cccedict 数据未就绪但压缩包 (`cedict_1_0_ts_utf-8_mdbg.zip`) 已下载，尝试查词时直接触发词典的后台构建，并向列表下发同步进度，构建完成后自动恢复当前查询。
        *   如果 cccedict 词典完全未下载，提示用户下载相关的 cccedict 词典数据，不再关注 ecdict 是否存在。

### 2. cccedict 构建器实现 (`backends/dict/cccedictBuilder.js` 或扩展 `builder.js`)
*   **解压文件**: 使用 `adm-zip` 解压 `cedict_1_0_ts_utf-8_mdbg.zip`，提取其中的 `cedict_ts.u8` 文本文件到临时目录。
*   **进度反馈机制**: 
    *   获取 `cedict_ts.u8` 的文件总大小 (bytes)。
    *   使用 `fs.createReadStream` 和 `readline` 模块逐行读取文件，累计已读取的字节数。
    *   格式化输出进度：“正在解析并生成数据库 (XX%)”。
*   **数据解析**: 逐行解析 `cedict_ts.u8`：
    *   忽略以 `#` 开头的注释行。
    *   通过正则解析 `繁体 简体 [拼音] /翻译/` 格式。
*   **持久化入库**:
    *   此处不考虑引用系统命令行 `sqlite3`，明确指定使用本项目已安装依赖中的 `sql.js`（`^1.10.0`）完成 SQLite 数据库生成操作。
    *   **详细设计**:
        1. **初始化内存库**: 通过 `require('sql.js')().then(SQL => {...})` 构建一个基于内存的数据库实例 (`const db = new SQL.Database();`)。
        2. **建表与索引**: 执行建表 `CREATE TABLE cccedict (traditional TEXT, simplified TEXT, pinyin TEXT, english TEXT);`。并补充创建查询索引以提升性能：`CREATE INDEX idx_cccedict_simplified ON cccedict(simplified);` 与 `CREATE INDEX idx_cccedict_traditional ON cccedict(traditional);`。
        3. **批量数据插入**: 为保证构建性能，使用事务 `db.exec("BEGIN TRANSACTION;");`。利用预编译语句 `const stmt = db.prepare("INSERT INTO cccedict VALUES (?,?,?,?)");`，在流式读取文本回调中不断调用 `stmt.run([trad, simp, pinyin, english])`。文本读取完毕后执行 `stmt.free(); db.exec("COMMIT;");`。
        4. **导出文件**: 事务提交后，调用 `const data = db.export();` 得到完整的 `Uint8Array` 格式数据库。然后转换为 Buffer（`Buffer.from(data)`），最后并通过 `fs.writeFileSync` 持久化地写入到 `cccedict.db` 实体文件中。
        5. **内存释放**: 及时执行 `db.close();` 释放对应的内存空间。
*   **清理工作**: 解压和入库完成后，删除原始的 `cedict_1_0_ts_utf-8_mdbg.zip` 以及中间解析的文本文件。

### 3. 衔接与调度
*   在 `commands/mode.js` 的 `handleSelect` 分支中，拦截对于 `CCCEDICT_DOWNLOADED_UNPROCESSED` 的选中操作。
*   开启进度显示，回调更新 uTools 列表。
*   等待 `cccedict` 构建成功后重刷新模式选择界面。

## 4. 用户场景与测试设计

### 4.1 用户场景
**场景1：全新安装且未下载任何词典**
* 前置条件：资源目录下无 `ecdict` 与 `cccedict` 资源及压缩包。
* 动作1：进入 `/mode`，观察“离线词典”项的描述。
* 动作2：选择“离线词典”项。
* 动作3：在未就绪状态下，直接在搜索框输入英文单词；或直接输入中文词汇。

**场景2：只下载了某一个词典**
* 前置条件：已存在 `ecdict.db`，但 `cccedict` 完全没有文件（或反之）。
* 动作1：进入 `/mode`。
* 动作2：尝试查包含就绪词典的数据，观察是否正常。
* 动作3：尝试查未下载完毕的对应词典语种，观察是否有相应的引导下载提示。

**场景3：下载了压缩包尚未转换 (cccedict)**
* 前置条件：资源目录下存在 `cedict_1_0_ts_utf-8_mdbg.zip`，以及 `ecdict.db`。或者两个都是压缩包。
* 动作1：进入 `/mode`，观察描述。
* 动作2：在主输入框输入中文字符尝试查词。
* 动作3：在 `/mode` 里选择离线词典项以触发手动解析流程。

**场景4：数据已完全就绪**
* 前置条件：资源目录下同时有 `ecdict.db` 与 `cccedict.db`。
* 动作1：进入 `/mode`，观察描述，并选中以切换至离线词典模式。
* 动作2：输入中、英文字符，检查响应速度及结果展示是否正常。

### 4.2 测试设计与验收标准

**1. 状态判断测试**
*   **Case 1.1**: 不存在任何由 `ecdict` 或 `cccedict` 相关的文件时，`/mode` 中应精确提示 `(词典未下载)`。
*   **Case 1.2**: 任一方（如 `ecdict` 就绪，但 `cccedict` 缺失文件；或反之）缺失时，提示 `(词典数据不完整)`。
*   **Case 1.3**: 至少一方是 `.zip` 文件，且另一方为 `.db` 或 `.zip` 时，提示 `(数据已下载，未转换)`。
*   **Case 1.4**: 两方的 `.db` 文件均正常存在，提示 `(数据已就绪)`。

**2. 解压与构建转化测试 (针对 cccedict)**
*   **Case 2.1**: 将合法的 `cedict_1_0_ts_utf-8_mdbg.zip` 放入资源目录，触发解析构建。期望：界面按百分比 `(0% ~ 100%)` 不断平滑刷新进度，无明显阻塞 UI 卡死。
*   **Case 2.2**: 构建完成后，期望 `cedict_1_0_ts_utf-8_mdbg.zip` 压缩包及中间过渡文件被自动删除，仅剩生成的 `cccedict.db` 文件。
*   **Case 2.3**: `cccedict.db` 中应包含原本 `cedict_ts.u8` 的全部有效行数据，且结构满足要求：`traditional`, `simplified`, `pinyin`, `english`。

**3. 查词拦截测试**
*   **Case 3.1 拦截与预处理**: 在模式为离线词典的情况下：
    *   若仅放入 `cedict_1_0_ts_utf-8_mdbg.zip`，当用户首次输入中文查询时，系统不可崩溃，应触发转换，并在列表中提示用户当前进度，转换完成后能恢复搜索并返回正确结果。
    *   若连 zip 也没有，输入中文时，返回空或在列表中产生一条假数据以引导去下载："词库未就绪：请确保安装 cccedict 相关词典..."（与现有逻辑对齐）。
