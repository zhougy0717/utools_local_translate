#!/usr/bin/env python3
"""
split_dict.py — 将 ecdict 词典压缩包分卷切割，方便上传至 Gitee。

每个分卷不超过指定大小（默认 45 MB），输出命名为: ecdict.zip.001, ecdict.zip.002, ...
同时生成 checksum.json，记录每个分卷的文件名、MD5 以及原始文件总大小，供客户端校验。

用法:
    python scripts/split_dict.py --input path/to/ecdict-sqlite-28.zip
    python scripts/split_dict.py --input path/to/ecdict-sqlite-28.zip --output dist/ --size 45
"""

import argparse
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# 默认分卷大小：45 MB（字节）
DEFAULT_CHUNK_MB = 45
DEFAULT_CHUNK_BYTES = DEFAULT_CHUNK_MB * 1024 * 1024

# 输出文件名前缀
VOLUME_PREFIX = "ecdict.zip."


def md5_of_file(path: Path) -> str:
    """计算文件的 MD5 值。"""
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8 * 1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def split_file(src: Path, output_dir: Path, chunk_bytes: int) -> list[dict]:
    """
    将 src 文件切割为若干分卷写入 output_dir。
    返回每个分卷的信息列表: [{filename, md5, size}]。
    """
    output_dir.mkdir(parents=True, exist_ok=True)

    volumes = []
    index = 1

    with open(src, "rb") as f:
        while True:
            data = f.read(chunk_bytes)
            if not data:
                break
            vol_name = f"{VOLUME_PREFIX}{index:03d}"
            vol_path = output_dir / vol_name
            vol_path.write_bytes(data)

            md5 = hashlib.md5(data).hexdigest()
            volumes.append({
                "filename": vol_name,
                "size": len(data),
                "md5": md5
            })
            print(f"  [{index:03d}] {vol_name}  {len(data) / 1024 / 1024:.2f} MB  md5={md5}")
            index += 1

    return volumes


def main() -> None:
    parser = argparse.ArgumentParser(
        description="将 ecdict 词典压缩包分卷切割并生成 checksum.json"
    )
    parser.add_argument(
        "--input", "-i",
        type=Path,
        required=True,
        help="源压缩包路径，如 path/to/ecdict-sqlite-28.zip"
    )
    parser.add_argument(
        "--output", "-o",
        type=Path,
        default=None,
        help="分卷输出目录（默认与源文件同目录）"
    )
    parser.add_argument(
        "--size", "-s",
        type=int,
        default=DEFAULT_CHUNK_MB,
        help=f"每个分卷的最大大小，单位 MB（默认 {DEFAULT_CHUNK_MB}）"
    )
    args = parser.parse_args()

    src = args.input if args.input.is_absolute() else ROOT / args.input
    if not src.is_file():
        print(f"错误：源文件不存在: {src}", file=sys.stderr)
        sys.exit(1)

    output_dir = args.output if args.output else src.parent
    if not output_dir.is_absolute():
        output_dir = ROOT / output_dir

    chunk_bytes = args.size * 1024 * 1024
    total_size = src.stat().st_size

    print(f"源文件  : {src}")
    print(f"输出目录: {output_dir}")
    print(f"分卷大小: {args.size} MB  总大小: {total_size / 1024 / 1024:.2f} MB")
    print()

    volumes = split_file(src, output_dir, chunk_bytes)

    # 生成 checksum.json
    checksum = {
        "source": src.name,
        "totalSize": total_size,
        "totalMd5": md5_of_file(src),
        "volumeCount": len(volumes),
        "volumes": volumes
    }
    checksum_path = output_dir / "checksum.json"
    checksum_path.write_text(json.dumps(checksum, indent=2, ensure_ascii=False), encoding="utf-8")

    print()
    print(f"分卷完成，共 {len(volumes)} 个分卷。")
    print(f"校验文件: {checksum_path}")
    print()
    print("上传清单（请将以下文件上传至 Gitee）:")
    for v in volumes:
        print(f"  {v['filename']}")
    print(f"  checksum.json")


if __name__ == "__main__":
    main()
