#!/usr/bin/env python3
"""
从国内站点下载 Helsinki-NLP OPUS-MT 英↔中模型，打包为 @xenova/transformers 可用的
目录并压缩为 .tar.gz，供插件首次使用时解压。

用法（在项目根目录执行）:
  python scripts/download_helsinki_model.py
  python scripts/download_helsinki_model.py --output resources/helsinki-opus-en-zh.tar.gz
  python scripts/download_helsinki_model.py --onnx          # ONNX 量化版，推荐
  python scripts/download_helsinki_model.py --source official   # 直连 Hugging Face（国外网络）

依赖:
  pip install huggingface_hub

国内站点（默认国内优先）:
  默认依次尝试：hf_mirror -> modelscope -> tuna -> baai -> bfsu -> aliyun，最后才 official。
  可用 --source 指定首选源，失败后仍会按上述顺序尝试其它国内镜像。
  可选源：hf_mirror、modelscope、tuna、baai、bfsu、aliyun、official。

输出:
  --output 指定的路径（默认 resources/helsinki-opus-en-zh.tar.gz），
  解压后得到 helsinki_models/ 目录，内含 opus-mt-en-zh/ 与 opus-mt-zh-en/ 两个子目录。
  默认下载 Helsinki-NLP PyTorch 格式；加 --onnx 则从 Xenova/transformers.js 下载 ONNX 量化版，
  供 Node 端 @xenova/transformers 直接加载（推荐）。
"""

import argparse
import os
import shutil
import tarfile
import tempfile
from pathlib import Path

# 国内镜像（必须在 import huggingface_hub 之前通过 HF_ENDPOINT 生效，脚本内按尝试顺序设置）
# 参考：https://hf-mirror.com、各镜像站文档
MIRRORS = {
    "hf_mirror": "https://hf-mirror.com",                      # 国内常用镜像，稳定
    "modelscope": "https://www.modelscope.cn/hf_mirror",       # 阿里云 / 魔搭
    "tuna": "https://huggingface.co.cn",                       # 清华 Tuna
    "baai": "https://huggingface.baai.ac.cn",                  # 智源 BAAI
    "bfsu": "https://mirrors.bfsu.edu.cn/hugging-face-models", # 北外 BFSU
    "aliyun": "https://mirror.aliyun.com/huggingface",         # 阿里云镜像
    "official": None,  # 直连 huggingface.co（国外）
}

# 国内源列表（用于「国内优先」的尝试顺序，不包含 official）
DOMESTIC_SOURCE_ORDER = ["hf_mirror", "modelscope", "tuna", "baai", "bfsu", "aliyun"]
DEFAULT_SOURCE = "hf_mirror"

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUTPUT = ROOT / "resources" / "helsinki-opus-en-zh.tar.gz"

# 英→中、中→英 两个模型，Helsinki-NLP 官方（PyTorch）
MODEL_IDS = [
    "Helsinki-NLP/opus-mt-en-zh",
    "Helsinki-NLP/opus-mt-zh-en",
]

# Xenova 量化 ONNX：实际文件在 seq2seq-lm-with-past 子目录下
XENOVA_ONNX_REL = "quantized/Helsinki-NLP/{model}/seq2seq-lm-with-past"
XENOVA_MODELS = ["opus-mt-en-zh", "opus-mt-zh-en"]

# 每个 ONNX 模型需下载的文件（相对于 seq2seq-lm-with-past）
XENOVA_ONNX_FILES = [
    "config.json",
    "decoder_model.onnx",
    "decoder_model_merged.onnx",
    "decoder_with_past_model.onnx",
    "encoder_model.onnx",
    "generation_config.json",
    "source.spm",
    "special_tokens_map.json",
    "target.spm",
    "tokenizer.json",
    "tokenizer_config.json",
    "vocab.json",
]


def _source_try_order(primary: str):
    """生成尝试顺序：首选 primary，然后其余国内源，最后 official（若首选不是 official）。"""
    order = [primary]
    for name in DOMESTIC_SOURCE_ORDER:
        if name != primary:
            order.append(name)
    if primary != "official":
        order.append("official")
    return [(name, MIRRORS[name]) for name in order]


def _try_snapshot_download(sources_to_try, base_path, download_fn):
    """依次尝试多个镜像源执行下载，每次使用新的 attempt_dir 避免沿用空目录。
    download_fn(attempt_dir: Path) 在给定目录下载并校验，成功则返回，失败抛异常。
    返回成功时的 attempt_dir。
    """
    last_error = None
    for i, (name, endpoint) in enumerate(sources_to_try):
        attempt_dir = base_path / f"try_{i}"
        attempt_dir.mkdir(parents=True, exist_ok=True)
        if endpoint:
            os.environ["HF_ENDPOINT"] = endpoint
            print(f"尝试源 [{name}]: {endpoint}")
        else:
            os.environ.pop("HF_ENDPOINT", None)
            print("尝试源 [official]: 直连 Hugging Face")
        try:
            download_fn(attempt_dir)
            return attempt_dir
        except Exception as e:
            last_error = e
            print(f"  失败: {e}")
            if attempt_dir.exists():
                shutil.rmtree(attempt_dir)
            continue
    if last_error:
        raise last_error
    return None  # unreachable


def _download_onnx_by_files(attempt_dir: Path) -> None:
    """当 snapshot_download 因「列仓库」API 失败时，用 hf_hub_download 按文件逐一下载（仅需单文件 HTTP）。"""
    from huggingface_hub import hf_hub_download

    repo_id = "Xenova/transformers.js"
    for model in XENOVA_MODELS:
        subdir = XENOVA_ONNX_REL.format(model=model)
        dest_dir = attempt_dir / subdir
        dest_dir.mkdir(parents=True, exist_ok=True)
        for fname in XENOVA_ONNX_FILES:
            rel_path = f"{subdir}/{fname}"
            print(f"  下载 {rel_path} ...")
            hf_hub_download(
                repo_id=repo_id,
                filename=rel_path,
                local_dir=str(attempt_dir),
                local_dir_use_symlinks=False,
            )
        if not (dest_dir / "config.json").exists():
            raise RuntimeError(f"按文件下载后仍缺少 config.json: {dest_dir}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="下载 OPUS-MT 英↔中模型并压缩为 helsinki-opus-en-zh.tar.gz"
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"输出 .tar.gz 路径（默认: {DEFAULT_OUTPUT}）",
    )
    parser.add_argument(
        "--onnx",
        action="store_true",
        help="从 Xenova/transformers.js 下载 ONNX 量化模型（供 @xenova/transformers 直接加载）",
    )
    parser.add_argument(
        "--source",
        choices=list(MIRRORS.keys()),
        default=DEFAULT_SOURCE,
        help="下载源：hf_mirror、modelscope、tuna、baai、bfsu、aliyun、official。默认国内优先: %(default)s",
    )
    args = parser.parse_args()

    # 国内环境：禁用 HF 上报，避免超时；并优先使用国内端点（在 import 前设置）
    os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
    if args.source != "official":
        os.environ.setdefault("HF_ENDPOINT", MIRRORS[args.source])

    # 尝试顺序：首选源 -> 其余国内源 -> official
    ordered = _source_try_order(args.source)

    try:
        from huggingface_hub import snapshot_download
    except ImportError:
        print("请先安装: pip install huggingface_hub")
        raise SystemExit(1)

    out_path = args.output.resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="helsinki_dl_") as tmp:
        tmp_path = Path(tmp)
        models_dir = tmp_path / "helsinki_models"
        models_dir.mkdir()

        if args.onnx:
            print("Downloading Xenova/transformers.js ONNX models (opus-mt-en-zh, opus-mt-zh-en)...")

            def do_onnx(attempt_dir):
                try:
                    snapshot_download(
                        repo_id="Xenova/transformers.js",
                        allow_patterns=[
                            "quantized/Helsinki-NLP/opus-mt-en-zh/seq2seq-lm-with-past/*",
                            "quantized/Helsinki-NLP/opus-mt-zh-en/seq2seq-lm-with-past/*",
                        ],
                        local_dir=str(attempt_dir),
                    )
                except Exception:
                    print("  snapshot_download 失败，改用按文件下载 (hf_hub_download)...")
                    _download_onnx_by_files(attempt_dir)
                for model in XENOVA_MODELS:
                    src = attempt_dir / XENOVA_ONNX_REL.format(model=model)
                    if not src.exists() or not (src / "config.json").exists():
                        raise RuntimeError("下载不完整或未获取到模型文件，将尝试下一源")

            ok_dir = _try_snapshot_download(ordered, tmp_path, do_onnx)
            for model in XENOVA_MODELS:
                src = ok_dir / XENOVA_ONNX_REL.format(model=model)
                dest = models_dir / model
                if src.exists():
                    shutil.copytree(src, dest)
                    print(f"  -> helsinki_models/{model}")
        else:
            for model_id in MODEL_IDS:
                name = model_id.split("/")[-1]
                dest = models_dir / name
                print(f"Downloading {model_id} -> {dest}")
                base_for_model = tmp_path / f"dl_{name}"

                def make_download(repo_id, final_dest):
                    def do(attempt_dir):
                        snapshot_download(repo_id=repo_id, local_dir=str(attempt_dir))
                        if not (attempt_dir / "config.json").exists() and not (attempt_dir / "pytorch_model.bin").exists():
                            raise RuntimeError("下载不完整或未获取到模型文件，将尝试下一源")
                        shutil.copytree(attempt_dir, final_dest)
                    return do

                _try_snapshot_download(ordered, base_for_model, make_download(model_id, str(dest)))

        archive_path = tmp_path / "helsinki-opus-en-zh.tar.gz"
        print(f"Creating {archive_path} from {models_dir}")
        with tarfile.open(archive_path, "w:gz") as tar:
            tar.add(models_dir, arcname=models_dir.name)

        archive_path.rename(out_path)
        print(f"Done: {out_path}")


if __name__ == "__main__":
    main()
