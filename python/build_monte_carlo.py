from __future__ import annotations

import argparse
import os
import platform
import shutil
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ONNXRUNTIME_VERSION = "1.22.1"
PROJECTS = {
    "normal": (
        ROOT / "native" / "monte-carlo",
        ROOT / "tmp" / "native" / "monte-carlo-cmake",
    ),
    "larc": (
        ROOT / "native" / "monte-carlo-larc",
        ROOT / "tmp" / "native" / "monte-carlo-larc-cmake",
    ),
}


def parse_args() -> argparse.Namespace:
    default_target = "all" if os.name == "nt" else "larc"
    parser = argparse.ArgumentParser(description="Build UmaShow recommendation components")
    parser.add_argument(
        "--target",
        choices=("all", "normal", "larc"),
        default=default_target,
        help=(
            "component to build; defaults to all on Windows and larc on Linux"
        ),
    )
    return parser.parse_args()


def onnxruntime_package() -> tuple[str, str]:
    machine = platform.machine().lower()
    if os.name == "nt":
        if machine not in {"amd64", "x86_64"}:
            raise RuntimeError(f"不支持的 Windows 架构：{machine}")
        package = f"onnxruntime-win-x64-{ONNXRUNTIME_VERSION}"
        return package, ".zip"
    if sys.platform.startswith("linux"):
        architecture = {
            "amd64": "x64",
            "x86_64": "x64",
            "aarch64": "aarch64",
            "arm64": "aarch64",
        }.get(machine)
        if architecture is None:
            raise RuntimeError(f"不支持的 Linux 架构：{machine}")
        package = f"onnxruntime-linux-{architecture}-{ONNXRUNTIME_VERSION}"
        return package, ".tgz"
    raise RuntimeError(f"当前系统不支持构建凯旋门推荐组件：{sys.platform}")


def runtime_files(root: Path) -> list[Path]:
    if os.name == "nt":
        library = root / "lib" / "onnxruntime.lib"
        runtime = root / "lib" / "onnxruntime.dll"
        return [library, runtime] if library.is_file() and runtime.is_file() else []
    return sorted((root / "lib").glob("libonnxruntime.so*"))


def valid_onnxruntime_root(root: Path) -> bool:
    return (root / "include" / "onnxruntime_cxx_api.h").is_file() and bool(
        runtime_files(root)
    )


def find_cmake() -> Path:
    explicit = os.environ.get("CMAKE_PATH")
    if explicit and Path(explicit).is_file():
        return Path(explicit)
    candidate = shutil.which("cmake")
    if candidate:
        return Path(candidate)
    raise FileNotFoundError("未找到 CMake；可通过 CMAKE_PATH 指定")


def ensure_onnxruntime() -> Path:
    package_name, archive_suffix = onnxruntime_package()
    explicit = os.environ.get("ONNXRUNTIME_ROOT")
    if explicit:
        root = Path(explicit).resolve()
        if valid_onnxruntime_root(root):
            return root
        raise FileNotFoundError(f"ONNXRUNTIME_ROOT 不是有效的当前平台包：{root}")

    cache_root = ROOT / "tmp" / "deps"
    package_root = cache_root / package_name
    if valid_onnxruntime_root(package_root):
        return package_root

    cache_root.mkdir(parents=True, exist_ok=True)
    archive = cache_root / f"{package_name}{archive_suffix}"
    if not archive.is_file():
        print(f"Downloading ONNX Runtime {ONNXRUNTIME_VERSION}...")
        url = (
            "https://github.com/microsoft/onnxruntime/releases/download/"
            f"v{ONNXRUNTIME_VERSION}/{archive.name}"
        )
        with tempfile.NamedTemporaryFile(
            dir=cache_root, suffix=".download", delete=False
        ) as temporary:
            temporary_path = Path(temporary.name)
        try:
            urllib.request.urlretrieve(url, temporary_path)
            temporary_path.replace(archive)
        finally:
            temporary_path.unlink(missing_ok=True)

    print(f"Extracting {archive.name}...")
    shutil.unpack_archive(archive, cache_root)
    if not valid_onnxruntime_root(package_root):
        raise FileNotFoundError(f"ONNX Runtime 解压结果不完整：{package_root}")
    return package_root


def main():
    args = parse_args()
    if args.target == "normal" and os.name != "nt":
        raise RuntimeError("普通推荐组件目前只用于 Windows；Linux 请构建 --target larc")
    selected_projects = (
        list(PROJECTS.items())
        if args.target == "all"
        else [(args.target, PROJECTS[args.target])]
    )
    cmake = str(find_cmake())
    onnxruntime_root = (
        ensure_onnxruntime()
        if any(name == "larc" for name, _ in selected_projects)
        else None
    )
    for name, (source_dir, build_dir) in selected_projects:
        if not (source_dir / "CMakeLists.txt").is_file():
            raise FileNotFoundError(f"未找到内置蒙特卡洛项目：{source_dir}")

        configure_command = [
            cmake,
            "-S",
            str(source_dir),
            "-B",
            str(build_dir),
        ]
        if os.name == "nt" and not os.environ.get("CMAKE_GENERATOR"):
            configure_command.extend(["-A", "x64"])
        elif os.name != "nt":
            configure_command.append("-DCMAKE_BUILD_TYPE=Release")
        if name == "larc":
            assert onnxruntime_root is not None
            configure_command.append(
                f"-DUMASHOW_ONNXRUNTIME_ROOT={onnxruntime_root}"
            )

        subprocess.run(configure_command, cwd=ROOT, check=True)
        subprocess.run(
            [
                cmake,
                "--build",
                str(build_dir),
                "--config",
                "Release",
                "--parallel",
            ],
            cwd=ROOT,
            check=True,
        )


if __name__ == "__main__":
    main()
