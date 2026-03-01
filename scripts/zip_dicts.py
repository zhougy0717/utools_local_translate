#!/usr/bin/env python3
"""
将 ecdict.db 与 cccedict.db 分别压缩为 ecdict.db.gz、cccedict.db.gz，用于减小插件发布体积。
发布包内仅包含 .gz，用户首次使用时由插件自动解压并删除 .gz。

用法（在项目根目录执行）:
  python scripts/zip_dicts.py
  python scripts/zip_dicts.py --output resources
  python scripts/zip_dicts.py --input resources --output dist/resources

可选参数:
  --input   输入目录，默认为项目 resources/
  --output  输出目录，默认为项目 resources/（与 --input 可相同，会覆盖/生成 .gz）
"""

import argparse
import gzip
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

DEFAULT_RESOURCES = ROOT / "resources"
DB_NAMES = ("ecdict.db", "cccedict.db")


def compress_one(src: Path, dest_gz: Path) -> None:
    """将 src 文件 gzip 压缩为 dest_gz。"""
    with open(src, "rb") as f_in:
        with gzip.open(dest_gz, "wb") as f_out:
            shutil.copyfileobj(f_in, f_out)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="将 ecdict.db、cccedict.db 压缩为 .gz，供发布使用"
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=DEFAULT_RESOURCES,
        help="输入目录，包含 ecdict.db 与 cccedict.db（默认: resources/）",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_RESOURCES,
        help="输出目录，将在此生成 ecdict.db.gz、cccedict.db.gz（默认: resources/）",
    )
    args = parser.parse_args()
    input_dir = args.input if args.input.is_absolute() else ROOT / args.input
    output_dir = args.output if args.output.is_absolute() else ROOT / args.output

    output_dir.mkdir(parents=True, exist_ok=True)
    for name in DB_NAMES:
        src = input_dir / name
        if not src.is_file():
            print("Skip (not found):", src, file=sys.stderr)
            continue
        dest = output_dir / (name + ".gz")
        print("Compressing", src, "->", dest)
        compress_one(src, dest)
    print("Done.")


if __name__ == "__main__":
    main()
