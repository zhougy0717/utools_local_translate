---
name: Project Packager
description: "用于对 uTools 查词插件项目进行一键打包、精简依赖并生成 release 发布的技能"
---

# Project Packager Skill

这个技能允许助手（Antigravity）及其它工具快速执行项目的打包发布流程。

## 功能特性
- **精简依赖**：自动运行 `npm prune --production`，确保发布包体积最小。
- **自动化拷贝**：根据配置自动将 `src`、`node_modules` 及核心配置文件拷贝至 `release/` 目录。
- **环境清理**：自动清理 `.DS_Store`、`.git` 等冗余文件。
- **一键执行**：通过调用内置脚本完成所有步骤。

## 目录结构
- `SKILL.md`: 技能说明文档。
- `scripts/pack.py`: 核心打包逻辑脚本。

## 使用方法
助手可以直接执行 `python scripts/pack.py` 或通过此技能的说明引导用户执行。

### 执行命令
```bash
python .agents/skills/project_packager/scripts/pack.py
```

## 注意事项
1. 打包过程会精简 `node_modules`。打包完成后，如果需要继续开发或运行测试，请执行 `npm install`。
2. 确保系统中已安装 Python 3 和 Node.js。
