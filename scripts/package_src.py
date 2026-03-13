#!/usr/bin/env python3
"""
打包项目源码为 zip，排除 .vscode、.cursor、node_modules、ECDICT 等目录。
resources 下仅打包压缩后的词库（.gz），不打包已解压的 .db，以减小体积。
用法: python scripts/package_src.py [输出路径]
"""

import argparse
import subprocess
import sys
import zipfile
from pathlib import Path

# 项目根目录（脚本在 scripts/ 下，上级即根目录）
ROOT = Path(__file__).resolve().parent.parent
RESOURCES = ROOT / "resources"
# 需要以 .gz 形式打包的词库（打包前若存在 .db 且无 .gz 会先压缩）
RESOURCE_DB_NAMES = ("ecdict.db", "cccedict.db")

# 排除的目录名（大小写敏感，与项目内实际名称一致）
EXCLUDE_DIRS = {".vscode", ".cursor", "node_modules", "ECDICT"}

# 排除的文件/目录（相对根目录的任意路径中包含这些即排除）
EXCLUDE_ANY = {".git"}

# resources 下不打包已解压的词典（只打包 .gz）
EXCLUDE_RESOURCE_DB = {"ecdict.db", "cccedict.db"}


def ensure_resource_gz() -> None:
    """若 resources 下存在 .db 但缺少对应 .gz，则先运行 zip_dicts.py 生成。"""
    need_gz = False
    for name in RESOURCE_DB_NAMES:
        db_path = RESOURCES / name
        gz_path = RESOURCES / (name + ".gz")
        if db_path.is_file() and not gz_path.is_file():
            need_gz = True
            break
    if not need_gz:
        return
    zip_dicts = ROOT / "scripts" / "zip_dicts.py"
    if not zip_dicts.is_file():
        print("警告: 未找到 scripts/zip_dicts.py，无法生成 .gz，打包结果将不包含词库压缩包。", file=sys.stderr)
        return
    subprocess.run(
        [sys.executable, str(zip_dicts)],
        cwd=str(ROOT),
        check=True,
    )


def should_exclude(rel_path: Path) -> bool:
    """判断相对路径是否应被排除。"""
    parts = rel_path.parts
    if not parts:
        return False
    # 顶层目录名
    if parts[0] in EXCLUDE_DIRS:
        return True
    if any(p in EXCLUDE_ANY for p in parts):
        return True
    if any(d in EXCLUDE_DIRS for d in parts):
        return True
    # resources 下不打包已解压的 .db，只打包 .gz
    if len(parts) >= 2 and parts[0] == "resources" and rel_path.name in EXCLUDE_RESOURCE_DB:
        return True
    # 不打包 resources/backup 目录
    if len(parts) >= 2 and parts[0] == "resources" and parts[1] == "backup":
        return True
    return False


def main() -> None:
    parser = argparse.ArgumentParser(description="打包源码（排除 .vscode/.cursor/node_modules/ECDICT）")
    parser.add_argument(
        "output",
        nargs="?",
        default=None,
        help="输出 zip 路径，默认: local_translate-src.zip",
    )
    args = parser.parse_args()

    # 打包前确保 resources 下有 .gz（若有 .db 无 .gz 则先执行 zip_dicts.py）
    ensure_resource_gz()

    if args.output:
        out_path = Path(args.output)
    else:
        out_path = ROOT / "local_translate-src.zip"

    out_path = out_path.resolve()
    if out_path.suffix.lower() != ".zip":
        out_path = out_path.with_suffix(out_path.suffix + ".zip")

    added = 0
    with zipfile.ZipFile(out_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in ROOT.rglob("*"):
            if not f.is_file():
                continue
            if f == out_path:
                continue  # 不把正在写的 zip 自己打进去
            try:
                rel = f.relative_to(ROOT)
            except ValueError:
                continue
            if should_exclude(rel):
                continue
            arcname = rel.as_posix()
            zf.write(f, arcname)
            added += 1

    print(f"已打包 {added} 个文件 -> {out_path}")


if __name__ == "__main__":
    main()
