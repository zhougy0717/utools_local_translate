# 本地词典 / 中英翻译（uTools 插件）

uTools 列表模式插件：输入单词或中文，自动识别语言并查词（英→中 / 中→英）。

## 功能

- **英→中**：输入英文单词，查询 ecdict 词库，展示释义与音标。
- **中→英**：输入中文（或含中文），查询 CC-CEDICT 词库，展示英文释义与拼音。
- 输入框会根据是否包含中文自动选择查词方向，无需手动切换。

## 词库（双 SQLite 数据库，支持压缩发布）

- **英→中**：`resources/ecdict.db`（表 `stardict`）；**中→英**：`resources/cccedict.db`（表 `cccedict`）。
- 发布包可仅包含 **ecdict.db.gz**、**cccedict.db.gz** 以减小体积。用户**首次使用**某方向查词时，插件会自动解压对应 .gz 为 .db 并删除 .gz，之后直接使用 .db，无需再次解压。

## 维护者：构建词库与压缩包

### 生成 cccedict.db

中→英词库由 CC-CEDICT 数据生成。维护者发布新版本前，可运行项目内 Python 脚本从网络下载 CC-CEDICT 并生成 `resources/cccedict.db`，与 ecdict.db 一并打包发布。

**运行方式（在项目根目录）：**

```bash
python3 scripts/build_cccedict.py
```

- 默认从 MDBG 官方下载 CC-CEDICT（UTF-8 GZip），解析并写入 `resources/cccedict.db`。
- 可选参数：
  - `--output <路径>`：指定输出 SQLite 文件路径（默认 `resources/cccedict.db`）。
  - `--url <URL>`：指定下载地址（默认 MDBG 官方链接）。

详见 `scripts/build_cccedict.py` 内注释。

### 压缩为 .gz（减小发布体积）

打包前可将两个 .db 压缩为 .gz，发布包内只带 .gz，用户首次使用时自动解压：

```bash
python3 scripts/zip_dicts.py
```

- 默认读取并输出到 `resources/`，生成 `ecdict.db.gz`、`cccedict.db.gz`。
- 可选：`--input <目录>`、`--output <目录>`。详见 `scripts/zip_dicts.py` 内注释。

## 打包发布

- 若使用压缩发布：发布前运行 `python3 scripts/zip_dicts.py`，将 `resources/` 下的 **ecdict.db.gz**、**cccedict.db.gz** 随插件打包即可；用户首次查词时自动解压并删除 .gz。
- 若不压缩：发布前确认 `resources/` 下存在 `ecdict.db` 与 `cccedict.db`，随插件一起打包。

## 离线词典资源下载指南

对于资源缺失或自主配置插件资源目录的用户，请按以下步骤获取词典：

1. **英→中词典 (ecdict.db)**
   - **下载来源**：[skywind3000/ECDICT](https://github.com/skywind3000/ECDICT)的Release页面[ ecdict-sqlite-28.zip](https://github.com/skywind3000/ECDICT-ultimate/releases/download/1.0.0/ecdict-sqlite-28.zip)
   - **安装方法**：将下载后的 `.zip` 文件直接存放于插件的本地资源目录（在插件中输入 `/path` 命令可配置或查看该本地路径）。然后在插件内通过 `/mode` 命令触发词典自动解压与构建即可，提取成功后旧的包将自动清理。

2. **中→英词典 (cccedict.db)**
   - **下载来源**：中英词典由开源项目 [MDBG Chinese Dictionary](https://www.mdbg.net/chinese/dictionary?page=cedict) 提供数据。
   - **安装方法**：将下载的cedict_1_0_ts_utf-8_mdbg.zip直接放入插件的本地资源目录（在插件中输入 `/path` 命令可配置或查看该本地路径）。然后在插件内通过 `/mode` 命令触发词典自动解压与构建即可，提取成功后旧的包将自动清理。

## 开发与测试

- 单元测试：`node --test test/isLikelyChinese.test.js test/ecdict.test.js`
- 设计文档：见 `doc/spec/spec-00001-ecdict.md`、`doc/spec/spec-00002-chinese-to-english.md`、`doc/spec/spec-00003-zipped-dict.md`。
