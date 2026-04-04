#!/usr/bin/env python3
import os
import shutil
import subprocess
import sys
from pathlib import Path

# 项目根目录 (由于脚本位置变动，需要向上寻找到项目根目录)
ROOT = Path(__file__).resolve().parent.parent.parent.parent.parent
RELEASE_DIR = ROOT / "release"

# 需要拷贝到 release 的文件和文件夹
FILES_TO_COPY = [
    "plugin.json",
    "package.json",
    "index.html",
    "preload.js",
    "translate.png",
    "LICENSE",
    "README.md",
]

DIRS_TO_COPY = [
    "src",
    "node_modules",
]

def run_npm_prune():
    """精简 node_modules，仅保留生产依赖"""
    print("1. 正在精简 node_modules (npm prune --production)...")
    
    # 注入常见路径到环境变量，确保 npm 能找到 node
    extra_paths = ["/usr/local/bin", "/opt/homebrew/bin", "/usr/bin"]
    os.environ["PATH"] = os.pathsep.join(extra_paths) + os.pathsep + os.environ.get("PATH", "")
    
    # 尝试找到 npm 命令
    npm_path = shutil.which("npm")
    
    if not npm_path:
        print("错误: 无法找到 npm 命令。请确保 Node.js 已安装并能在 PATH 中访问。")
        sys.exit(1)

    try:
        # 使用 env 参数确保子进程也能看到更新后的 PATH
        # 确保 npm_path 不为 None (前面已经检查过，但为了 lint 加强一下)
        if npm_path:
            subprocess.run([str(npm_path), "prune", "--production"], cwd=str(ROOT), check=True, env=os.environ)
    except subprocess.CalledProcessError as e:
        print(f"错误: npm prune 执行失败 (exit code: {e.returncode})。")
        sys.exit(1)

def prepare_release_dir():
    """清理并创建 release 目录"""
    print("2. 正在清理 release 目录...")
    if RELEASE_DIR.exists():
        shutil.rmtree(RELEASE_DIR)
    RELEASE_DIR.mkdir(parents=True, exist_ok=True)

def copy_files():
    """拷贝必要的文件和目录"""
    print("3. 正在拷贝必要文件到 release...")
    
    # 拷贝文件
    for file_name in FILES_TO_COPY:
        src = ROOT / file_name
        dst = RELEASE_DIR / file_name
        if src.is_file():
            shutil.copy2(src, dst)
            print(f"   - 已拷贝文件: {file_name}")
            
    # 拷贝目录
    for dir_name in DIRS_TO_COPY:
        src = ROOT / dir_name
        dst = RELEASE_DIR / dir_name
        if src.is_dir():
            shutil.copytree(src, dst)
            print(f"   - 已拷贝目录: {dir_name}")

def post_cleanup():
    """清理 release 目录中的垃圾文件和不必要的资源"""
    print("4. 正在清理 release 中的冗余文件...")
    
    # 定义要删除的文件和目录名模式
    JUNK_NAMES = {
        ".DS_Store", ".git", ".history", "__pycache__", 
        ".vscode", ".idea", ".github", ".gitignore",
        "node.dev.js", "npm-debug.log"
    }
    
    # 定义要在 node_modules 中删除的目录（通常是不影响运行的资源）
    MODULE_JUNK_DIRS = {
        "test", "tests", "example", "examples", "docs", "doc", 
        "benchmark", "scripts", ".bin"
    }

    # 定义要删除的调试和源文件后缀 (uTools 禁止提交此类文件)
    DEBUG_EXTENSIONS = {
        ".map", ".js.gz", ".ts", ".tsx", ".less", ".sass", ".scss", 
        ".flow", ".coffee", ".yml", ".yaml", ".log"
    }

    # 1. 通用冗余清理 (针对文件名)
    for item in list(RELEASE_DIR.rglob("*")):
        # 如果是目录且在废弃名单中
        if item.is_dir() and item.name in JUNK_NAMES:
            shutil.rmtree(item, ignore_errors=True)
            continue
            
        # 如果是文件
        if item.is_file():
            # 按文件名删除
            if item.name in JUNK_NAMES:
                item.unlink()
            # 按后缀名删除 (调试文件)
            elif item.suffix.lower() in DEBUG_EXTENSIONS or item.name.endswith(".js.gz"):
                item.unlink()
                
    # 2. 针对 node_modules 的深度精简
    node_modules_path = RELEASE_DIR / "node_modules"
    if node_modules_path.is_dir():
        for item in list(node_modules_path.rglob("*")):
            if not item.exists(): continue
            
            # 删除隐藏文件（如 .package-lock.json, .travis.yml 等）
            if item.is_file() and item.name.startswith("."):
                item.unlink()
            # 如果是已知的精简目录
            elif item.is_dir() and item.name.lower() in MODULE_JUNK_DIRS:
                shutil.rmtree(item, ignore_errors=True)
            # 删除 Markdown 说明文件和报告 (保留 LICENSE)
            elif item.is_file() and item.suffix.lower() in {".md", ".markdown", ".txt", ".html", ".pdf"}:
                if item.name.lower() != "license" and item.parent.name.lower() != "src": # 不删除 src 下的 html
                    # 保留 LICENSE，删除 readme, changelog, history 等
                    item.unlink()

def main():
    print("=== 开始打包发布过程 (Python 版) ===")
    
    # 1. 精简依赖
    run_npm_prune()
    
    # 2. 准备目录
    prepare_release_dir()
    
    # 3. 拷贝内容
    copy_files()
    
    # 4. 后置清理
    post_cleanup()
    
    print("\n=== 打包发布完成！ ===")
    print(f"核心发布包已就绪: {RELEASE_DIR}")
    print("提示: 若需恢复开发环境（如运行测试），请在根目录执行 'npm install'。")

if __name__ == "__main__":
    main()
