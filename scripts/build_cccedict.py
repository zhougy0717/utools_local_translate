#!/usr/bin/env python3
"""
从网络下载 CC-CEDICT 数据，解析并转换为 SQLite，保存到 resources/cccedict.db。

用法（在项目根目录执行）:
  python scripts/build_cccedict.py
  python scripts/build_cccedict.py --output resources/cccedict.db
  python scripts/build_cccedict.py --url "https://example.com/cedict_ts.u8"

可选参数:
  --output  输出 SQLite 文件路径，默认为项目 resources/cccedict.db
  --url     下载地址，默认为 MDBG 提供的 CC-CEDICT UTF-8 GZip 文件
"""

import argparse
import gzip
import re
import sqlite3
import sys
from pathlib import Path

# 项目根目录（脚本在 scripts/ 下，上级即根目录）
ROOT = Path(__file__).resolve().parent.parent

# 默认下载 URL（MDBG 官方 CC-CEDICT UTF-8 GZip）
DEFAULT_URL = "https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz"

# 每行格式: 繁体 简体 [拼音] /英文释义1/释义2/
# 示例: 中國 中国 [Zhong1 guo2] /China/Middle Kingdom/
LINE_PATTERN = re.compile(
    r"^\s*(\S+)\s+(\S+)\s+\[([^\]]*)\]\s+/(.+)/\s*$"
)


def download_cedict(url: str) -> bytes:
    """从 url 下载数据，若为 gzip 则解压后返回 UTF-8 字节。"""
    try:
        from urllib.request import urlopen, Request
    except ImportError:
        from urllib2 import urlopen, Request  # type: ignore
    req = Request(url, headers={"User-Agent": "local_translate-build_cccedict/1.0"})
    with urlopen(req, timeout=60) as resp:
        data = resp.read()
    if url.endswith(".gz") or resp.headers.get("Content-Encoding") == "gzip":
        data = gzip.decompress(data)
    return data


def parse_line(line: str):
    """
    解析一行 CC-CEDICT。返回 (traditional, simplified, pinyin, english) 或 None。
    跳过注释行（#）和空行。
    """
    line = line.strip()
    if not line or line.startswith("#"):
        return None
    m = LINE_PATTERN.match(line)
    if not m:
        return None
    traditional, simplified, pinyin, rest = m.groups()
    # 英文释义可能含 /，取第一个或全部用空格连接（这里取第一个为主，多释义用 "; " 连接）
    english = rest.replace("/", "; ").strip() if rest else ""
    return (traditional, simplified, pinyin, english)


def build_db(cedict_text: str, db_path: Path) -> int:
    """
    解析 cedict 文本，写入 SQLite。表 cccedict(simplified, traditional, pinyin, english)。
    返回写入行数。
    """
    db_path.parent.mkdir(parents=True, exist_ok=True)
    if db_path.exists():
        db_path.unlink()
    conn = sqlite3.connect(str(db_path))
    conn.execute("""
        CREATE TABLE cccedict (
            simplified TEXT,
            traditional TEXT,
            pinyin TEXT,
            english TEXT
        )
    """)
    conn.execute("CREATE INDEX idx_cccedict_s ON cccedict(simplified)")
    conn.execute("CREATE INDEX idx_cccedict_t ON cccedict(traditional)")
    count = 0
    for line in cedict_text.splitlines():
        row = parse_line(line)
        if row is None:
            continue
        conn.execute(
            "INSERT INTO cccedict (simplified, traditional, pinyin, english) VALUES (?, ?, ?, ?)",
            row,
        )
        count += 1
    conn.commit()
    conn.close()
    return count


def main():
    parser = argparse.ArgumentParser(
        description="下载 CC-CEDICT 并生成 resources/cccedict.db"
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=ROOT / "resources" / "cccedict.db",
        help="输出 SQLite 文件路径（默认: resources/cccedict.db）",
    )
    parser.add_argument(
        "--url",
        type=str,
        default=DEFAULT_URL,
        help="CC-CEDICT 下载地址（默认: MDBG 官方 GZip）",
    )
    args = parser.parse_args()
    out_path = args.output
    if not out_path.is_absolute():
        out_path = ROOT / out_path

    print("Downloading CC-CEDICT from:", args.url, flush=True)
    try:
        raw = download_cedict(args.url)
        text = raw.decode("utf-8")
    except Exception as e:
        print("Download failed:", e, file=sys.stderr)
        sys.exit(1)

    print("Building SQLite at:", out_path, flush=True)
    try:
        n = build_db(text, out_path)
        print("Done. Wrote", n, "entries to", out_path)
    except Exception as e:
        print("Build failed:", e, file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
