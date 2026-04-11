# Spec-00042: 移除冗余的 /libre 斜线命令

## 1. 背景
在最近的更新（特别是 Spec-00041）中，我们为 LibreTranslate 后端实现了“统一配置面板”。这个可视化面板允许用户比旧的斜线命令更直观地配置 API 地址和 API Key。

目前 `/libre` 命令（通过在搜索栏输入 `/libre` 触发）已经变得冗余，保留它会增加代码库的复杂性，并可能给用户带来困惑。

## 2. 目标
-   从插件的命令搜索列表中移除 `/libre` (LibreTranslate) 斜线命令。
-   清理过时的源代码及关联的单元测试。
-   确保通过 `/mode` 进入的“统一配置面板”功能不受影响。

## 3. 实施细节

### 3.1 源代码变更

#### 3.1.1 `src/commands/index.js`
-   移除 `const libreCommand = require('./libre.js');`。
-   从 `COMMANDS` 数组中移除 `libreCommand`。
-   清理 `handleSearch` 中针对 `cmd.trigger === 'libre'` 的图标硬编码逻辑。

#### 3.1.2 待删除文件
-   `src/commands/libre.js`：实现 `/libre` 命令逻辑的文件。
-   `test/libretranslate-command.test.js`：测试 `/libre` 命令逻辑的文件。

### 3.2 保留的资源
-   `src/commands/icons.js` 中的 `Icons.LIBRE`：必须保留，因为 `src/commands/mode.js` 仍需使用它在模式选择列表中代表 LibreTranslate 后端。
-   `src/backends/libretranslate/*`：后端目录下的所有文件保持不变，它们负责实际的翻译逻辑和新的可视化配置 UI。

## 4. 验证计划

### 4.1 手动验证
1.  打开 uTools 并进入插件。
2.  输入 `/`。
3.  **预期结果**：列表中**不应**出现 `/libre`（或“配置 LibreTranslate”）。
4.  输入 `/mode`。
5.  选择 `LibreTranslate (OSS)`。
6.  选择 `打开 LibreTranslate 配置面板`。
7.  **预期结果**：可视化配置面板正常打开并能够正常工作。

### 4.2 自动化验证
1.  运行 `npm test`。
2.  **预期结果**：现有的所有测试应通过。被删除的测试文件不应再被执行。

## 5. 影响分析
-   **用户影响**：用户将不能再使用 `/libre <url> <key>` 这种简写方式进行配置，必须改用可视化 UI。考虑到可视化 UI 更加稳健且易于使用，这通常被视为一种改进。
-   **开发影响**：需要维护的文件和测试更少。命令行风格的工具与以 UI 为核心的配置逻辑之间界限更加清晰。
