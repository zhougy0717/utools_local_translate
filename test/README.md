# 单元测试

本目录存放项目单元测试，使用 **Node 内置 node:test** 框架。

- 测试对象：**backends/ecdict** 查词后端，验证使用 JavaScript 从 SQLite（ecdict.db）查词功能。
- 运行方式：在项目根目录执行 `npm test` 或 `node --test test/`。
- 说明与用例详见 [spec-00001-ecdict 单元测试章节](../doc/spec/spec-00001-ecdict.md#6-单元测试)。
- 查词用例使用项目内 `resources/ecdict.db`（已知词以 "nite" 为例）；「词库不存在」用例使用虚构路径。
