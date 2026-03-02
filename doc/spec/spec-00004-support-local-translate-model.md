# spec-00004 支持本地 Helsinki-NLP 模型翻译

## 需求

- 支持本地使用 **Helsinki-NLP（OPUS-MT）** 模型进行翻译。
- **识别中英文的方法不变**：仍由 preload 通过 `isLikelyChinese(text)` 决定 `sourceLang`/`targetLang`（'en'↔'zh'），与现有 ecdict 行为一致。
- 提供一个**单独的 backend**，以支持使用 Helsinki-NLP 模型进行翻译（与 ecdict 后端并列，可插拔）。
- 提供**单元测试**，基于 **node:test**，验证是否能基于 Helsinki-NLP 模型进行翻译。
- 要求模型能够**预先离线下载**，**压缩后打包到插件中**，在**第一次使用时解压缩**。

---

## 软件设计

### 1. 架构概览

- **统一查词接口不变**：与 spec-00001 一致，所有后端实现 `queryWord(word, sourceLang, targetLang, callback)`，返回 `{ found, translation?, phonetic?, message? }`。preload 不感知后端类型，仅根据配置或选择加载对应后端并调用该接口。
- **语言方向由 preload 决定**：继续在调用 `queryWord` 前用 `isLikelyChinese(text)` 设置 `sourceLang`/`targetLang`，Helsinki 后端只接收并处理 (word, 'en'|'zh', 'zh'|'en')。
- **新增 Helsinki 后端**：独立模块 `backends/helsinki.js`，内部使用 OPUS-MT 类模型（如通过 `@xenova/transformers` 的 ONNX 或 Node 侧 ONNX Runtime）做神经翻译；对外与 ecdict 同一接口，便于 preload 或后续配置切换后端。
- **后端选择**：preload 通过**后端选择变量**决定使用哪一个后端；**当前默认选择 Helsinki-NLP 模型**。该变量后续将交由配置页面读写，实现用户可选的 ecdict / Helsinki 切换（见 2.3 节）。
- **模型分发与首次解压**：发布包中在 `resources/` 下提供**压缩后的模型包**（如 `helsinki-opus-en-zh.tar.gz` 或按实际命名）；Helsinki 后端在首次需要翻译时检查解压目录是否存在，若不存在则从该压缩包解压到指定目录（如 `resources/helsinki-models/` 或用户数据目录），解压成功后可选删除压缩包（与 spec-00003 词库 .gz 行为类似），后续直接使用已解压模型。

- **运行环境与 `@xenova/transformers` 的加载方式**：插件可能运行在 **Node**（如本机单测、CLI）或 **Electron**（如 uTools）中。
  - 尝试在所有环境中（含 Node 和 Electron/uTools），直接在 `backends/helsinki.js` 内使用动态 `import('@xenova/transformers')` 语法导入模块，完成解压与推理。不再使用独立 Node 子进程。

**目标软件架构（类图）**：

```plantuml
@startuml spec-00004-class
skinparam defaultFontName "Microsoft YaHei,Sans"
skinparam defaultFontSize 12

interface "« 查词后端 »\nBackend" as Backend {
  + queryWord(word, sourceLang, targetLang, callback): void
}

class "preload.js\n(插件入口)" as Preload {
  - currentBackendId: 'ecdict' | 'helsinki'
  - backend: Backend
  + isLikelyChinese(text): boolean
  + buildListItems(searchWord, result, isZhToEn): ListItem[]
  + enter(action, callbackSetList): void
  + search(action, searchWord, callbackSetList): void
}

class "backends/ecdict.js\nEcdict 后端" as Ecdict {
  + createEcdictBackend(options): Backend
  - queryWord(word, sourceLang, targetLang, callback): void
}

class "backends/helsinki.js\nHelsinki 后端" as Helsinki {
  + createHelsinkiBackend(options): Backend
  - ensureModelUnpacked(): { ok, message? }
  - getLocalModelPath(sourceLang, targetLang): string | null
  - queryWord(word, sourceLang, targetLang, callback): void
}

class "模型压缩包\n(.tar.gz)" as Archive <<resource>> {
  路径: modelArchivePath
}

class "已解压模型目录\n(modelDir)" as ModelDir <<resource>> {
  路径: modelDir
  内容: helsinki_models/opus-mt-*
}

Preload o--> Backend : 持有
Preload ..> Preload : isLikelyChinese 决定\nsourceLang / targetLang

Ecdict ..|> Backend : 实现
Helsinki ..|> Backend : 实现

Helsinki --> Archive : 首次使用时解压
Helsinki --> ModelDir : 解压目标\n加载模型

note right of Backend
  result: { found, translation?,
  phonetic?, message? }
  仅支持 ('en','zh') / ('zh','en')
end note
@enduml
```

**数据流（序列图）**：

```plantuml
@startuml spec-00004-flow
skinparam defaultFontName "Microsoft YaHei,Sans"
skinparam defaultFontSize 12

actor 用户
participant "preload.js" as Preload
participant "helsinki.js" as Backend
participant "模型压缩包\n(.tar.gz)" as Archive
participant "已解压模型目录" as ModelDir

用户 -> Preload : 输入文本
Preload -> Preload : isLikelyChinese → sourceLang, targetLang
Preload -> Backend : queryWord(word, sourceLang, targetLang)
Backend -> Backend : 需要翻译时检查模型
alt 已解压目录存在
  Backend -> ModelDir : 加载模型
else 仅存在压缩包
  Backend -> Archive : 解压到目标目录
  Backend -> Archive : 可选删除 .tar.gz
  Backend -> ModelDir : 加载模型
end
Backend -> Backend : 推理得到译文
Backend --> Preload : found, translation
Preload --> 用户 : 下拉列表展示

@enduml
```

### 2. 模块设计

#### 2.1 输入语言检测（preload.js）

- **不变**：继续使用现有 `isLikelyChinese(text)`（检测 CJK 统一汉字 `\u4e00-\u9fff`）在 `args.search` 与 `args.enter` 中决定 `sourceLang`、`targetLang`，再调用当前后端的 `queryWord(word, sourceLang, targetLang, callback)`。Helsinki 后端不实现语言检测，只按传入的语言对翻译。

#### 2.2 Helsinki 后端（backends/helsinki.js）

- **职责**：
  - 实现与 ecdict 一致的 **`queryWord(word, sourceLang, targetLang, callback)`**，回调 `(err, result)`，`result` 为 `{ found, translation?, phonetic?, message? }`。
  - 首次需要翻译时：若已解压模型目录不存在，则从配置的压缩包路径（如 `resources/helsinki-opus-en-zh.tar.gz`）解压到目标目录（如 `resources/helsinki-models/`），解压成功后可选删除压缩包；若解压失败或模型不可用，返回 `{ found: false, message: "模型未就绪或解压失败" }`。
  - 使用解压后的模型进行 en↔zh 神经翻译；`phonetic` 可为空（神经翻译无音标），或省略。
- **接口约定**：
  - 支持 `createHelsinkiBackend(options)`，`options` 可包含：`modelArchivePath`（压缩包路径）、`modelDir`（解压目标目录）、是否解压后删除压缩包等，便于测试与配置。
  - 仅支持 `(sourceLang, targetLang)` 为 `('en','zh')` 或 `('zh','en')`；其他语言对可返回 `{ found: false, message: "不支持的语言对" }`。
- **实现方式**：
  - 推理引擎：**@xenova/transformers**（Node 下使用 ONNX）或 **onnxruntime-node** 直接加载 ONNX 格式的 OPUS-MT 模型；模型文件由维护者预先从 Hugging Face 等下载并转为可打包格式，再压缩。
  - 解压使用 Node 内置 `zlib` 或 `tar` 库（如 `tar.gz` 需用 `tar` 解包）将压缩包解到 `modelDir`，逻辑封装在 `ensureModelUnpacked()` 或等价函数内，对外仅暴露「模型是否就绪」。
  - **运行环境统一处理**：不再区分 Node 环境和 Electron 环境。不论是单测、本机还是 uTools 中，均尝试直接在 `backends/helsinki.js` 中使用动态 `import('@xenova/transformers')`。不再使用独立 Node 子进程和 IPC（详见 2.5 节）。
- **错误与边界**：模型未下载、解压失败、推理异常时均返回 `{ found: false, message?: "..." }`，不向上抛未捕获异常。

#### 2.3 后端选择（preload.js）

- **选择变量**：在 preload 中增加**后端选择变量**（如 `currentBackendId`），取值约定为 `'ecdict'` 或 `'helsinki'`。
- **当前默认**：**默认使用 Helsinki-NLP 模型**，即 `currentBackendId` 初始值为 `'helsinki'`（或项目内约定的常量如 `BACKEND_IDS.HELSINKI`）。
- **按变量创建后端**：根据 `currentBackendId` 决定 `require` 并实例化哪一个后端（`createEcdictBackend()` 或 `createHelsinkiBackend()`），得到统一的 `queryWord` 接口对象，后续 search/enter 仅调用该对象的 `queryWord`，不写死具体后端。
- **后续扩展**：配置页面实现后，由配置页读写用户选择并写入持久化配置，preload 启动时读取配置并设置 `currentBackendId`，再按上述逻辑创建对应后端；本需求仅预留选择变量与分支逻辑，不实现配置页。

#### 2.4 模型打包与首次解压

- **发布包**：在 `resources/` 下提供**预下载并压缩**的模型包（如 `helsinki-opus-en-zh.tar.gz`），不随插件运行时从网络下载；仅维护者在打包前通过脚本下载并压缩。
- **解压策略**（与 spec-00003 词库一致）：
  1. 若 `modelDir` 已存在且包含所需模型文件 → 直接使用，不解压。
  2. 若 `modelDir` 不存在且压缩包存在 → 解压到 `modelDir`，解压成功后可选删除压缩包。
  3. 若压缩包也不存在 → 返回 `{ found: false, message: "模型未就绪" }`。
- **脚本**：在 `scripts/` 下提供**下载与打包脚本**（如 `scripts/download_helsinki_model.py` 或 `.sh`），供维护者执行：从 Helsinki-NLP/Hugging Face 下载指定 OPUS-MT 模型（如 en↔zh），转换为可被后端加载的格式（如 ONNX），并压缩为 `resources/` 下约定名称的压缩包；脚本说明写入 README 或脚本内注释。

#### 2.5 Electron/uTools 下 Helsinki 推理

在 Electron（如 uTools）中，我们将尝试**直接使用动态 `import()` 语句加载** `@xenova/transformers`。

- 不采用子进程方案，避免增加进程通信的复杂性。
- 在 `backends/helsinki.js` 中直接使用 `import('@xenova/transformers')` 加载模型和执行翻译。
- 核心在于**同进程加载**，不再依赖进程间的划分。如果在 Electron 环境下遇到 `onnxruntime-node` 不兼容或者崩溃的问题，将优先尝试直接在主进程中通过常规模块加载的方式解决。

**产出**：在 uTools 中直接在当前进程加载模块、完成翻译操作。

### 3. 单元测试（node:test）

- **位置**：`test/helsinki.test.js`。
- **方式**：与 `test/ecdict.test.js` 类似，`require` 后端后通过 `queryWord(word, sourceLang, targetLang, callback)` 的 Promise 封装进行断言。
- **用例建议**：
  - **有模型时**：`queryWord('hello', 'en', 'zh', ...)` 断言 `result.found === true`、`result.translation` 为字符串且非空（可放宽为包含中文字符）；`queryWord('你好', 'zh', 'en', ...)` 断言 `found === true`、`translation` 为英文非空。
  - **无模型/未解压时**：使用指向不存在路径的 `createHelsinkiBackend({ modelArchivePath: notExist, modelDir: ... })`，调用 `queryWord` 断言 `found === false`，且若有 `message` 则非空。
  - **首次解压**（可选）：在仅提供压缩包的测试目录下创建 backend，首次调用 `queryWord` 触发解压，断言返回 `found === true` 且解压目录已生成；再次调用仍返回正确结果。若测试环境无真实模型包，该用例可 `this.skip()`。
- **运行**：`node --test test/helsinki.test.js`（与现有 ecdict 测试一致）。

### 4. 数据流（首次使用英→中为例）

**Node 环境（单测/本机）**：
1. 用户输入英文，preload 通过 `isLikelyChinese` 得到 `sourceLang='en'`, `targetLang='zh'`，调用 `backend.queryWord(word, 'en', 'zh', callback)`。
2. Helsinki 后端检查 `modelDir` 是否存在；不存在则查找 `resources/helsinki-opus-en-zh.tar.gz`，解压到 `modelDir` 并可选删除 .tar.gz。
3. 从 `modelDir` 加载模型，执行推理得到中文译文，回调 `(null, { found: true, translation: "..." })`。
4. preload 按统一结构组列表项并展示；后续请求若模型已加载可直接推理，无需重复解压。

**Electron/uTools 环境**：与 Node 环境相同，直接调用 `backend.queryWord`，在内部动态 `import` 加载 transformers 并执行推理。

### 5. 文件与目录

```
backends/
├── ecdict.js
├── helsinki.js                  # Helsinki-NLP 翻译后端

resources/
├── ecdict.db.gz
├── cccedict.db.gz
├── helsinki-opus-en-zh.tar.gz   # 发布包内：预下载并压缩的模型
└── helsinki-models/             # 首次使用后解压生成（或用户数据目录）

scripts/
├── zip_dicts.py
└── download_helsinki_model.py   # 维护者下载并压缩模型

test/
├── ecdict.test.js
└── helsinki.test.js             # Helsinki 后端 node:test
```

### 6. 与现有设计的关系

- **preload**：不修改语言检测逻辑；通过**后端选择变量**（默认 `helsinki`）决定使用 `createEcdictBackend()` 或 `createHelsinkiBackend()`，调用方式一致；后续由配置页面驱动该变量。
- **ecdict 后端**：不改动，与 Helsinki 后端并列存在。
- **spec-00003**：词库 .db.gz 首次解压、删除 .gz 的流程与模型 .tar.gz 首次解压、可选删除压缩包的流程一致，仅封装在各自后端内部。

### 7. 验收要点

- 新增 `backends/helsinki.js`，实现 `createHelsinkiBackend(options)` 与 `queryWord(word, sourceLang, targetLang, callback)`，返回结构与 ecdict 一致。
- 模型以压缩包形式随插件发布，首次使用时解压到指定目录，解压成功后可选删除压缩包；后续直接使用已解压模型。
- 识别中英文的方法仍为 preload 的 `isLikelyChinese`，未改动。
- `node --test test/helsinki.test.js` 通过，能验证在有模型情况下可完成 en↔zh 翻译，无模型时返回 `found: false` 及合理 message。
- **Electron/uTools 下**：尝试直接在当前进程使用动态 `import('@xenova/transformers')` 加载并执行推理，不再使用原定的子进程方案。
- 提供脚本供维护者预下载并压缩模型，文档或注释说明用法。
- preload 中增加后端选择变量，默认值为 Helsinki；根据该变量创建对应后端，后续可通过配置页面切换。

以上为 spec-00004 的完整需求与软件设计，可直接作为实现与验收依据。