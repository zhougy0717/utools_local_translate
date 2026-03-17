# 打包发布指南

本项目主要通过 Python 脚本进行快速打包发布。打包后的内容将生成在 `release/` 目录中，可直接用于 uTools 插件的加载或分发。

## 运行要求

- **Python 3.x**: 用于执行打包脚本。
- **Node.js & npm**: 打包过程中会调用 `npm prune --production` 来减少包体积。

## 打包步骤

### 1. 自动打包

在项目根目录下，执行以下命令即可完成一键打包：

```bash
python3 scripts/release.py
```

或者使用 `npm` 快捷脚本：

```bash
npm run release
```

### 2. 脚本执行细节

脚本 `scripts/release.py` 会自动完成以下操作：
1. **精简依赖**：执行 `npm prune --production`，自动删除 `devDependencies`（如单元测试工具等）。
2. **清理环境**：自动清空旧的 `release/` 目录。
3. **资源拷贝**：将运行所需的顶层文件和目录拷贝至 `release/`：
    - **目录**：`src/`、`node_modules/` (精简后)
    - **文件**：`plugin.json`、`preload.js`、`index.html`、`package.json`、`translate.png`、`LICENSE`、`README.md`
4. **冗余清理**：自动移除目录中的 `.DS_Store`、`.git` 等无关文件。

## 注意事项

- **恢复开发环境**：
  由于打包过程会删除开发依赖，打包完成后如果需要运行测试（`npm run test`）或继续开发，请务必在命令目录执行：
  ```bash
  npm install
  ```
- **注意**：
  由于不再离线集成词库，用户在首次使用时将根据配置自动下载所需资源。

