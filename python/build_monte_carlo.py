from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
import urllib.request
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ONNXRUNTIME_VERSION = "1.22.1"
ONNXRUNTIME_PACKAGE = f"onnxruntime-win-x64-{ONNXRUNTIME_VERSION}"
ONNXRUNTIME_URL = (
    "https://github.com/microsoft/onnxruntime/releases/download/"
    f"v{ONNXRUNTIME_VERSION}/{ONNXRUNTIME_PACKAGE}.zip"
)
PROJECTS = (
    (
        ROOT / "native" / "monte-carlo",
        ROOT / "tmp" / "native" / "monte-carlo-cmake",
    ),
    (
        ROOT / "native" / "monte-carlo-larc",
        ROOT / "tmp" / "native" / "monte-carlo-larc-cmake",
    ),
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
    explicit = os.environ.get("ONNXRUNTIME_ROOT")
    if explicit:
        root = Path(explicit).resolve()
        if (root / "include" / "onnxruntime_cxx_api.h").is_file() and (
            root / "lib" / "onnxruntime.lib"
        ).is_file() and (root / "lib" / "onnxruntime.dll").is_file():
            return root
        raise FileNotFoundError(f"ONNXRUNTIME_ROOT 不是有效的 Windows x64 包：{root}")

    cache_root = ROOT / "tmp" / "deps"
    package_root = cache_root / ONNXRUNTIME_PACKAGE
    if (package_root / "include" / "onnxruntime_cxx_api.h").is_file() and (
        package_root / "lib" / "onnxruntime.lib"
    ).is_file() and (package_root / "lib" / "onnxruntime.dll").is_file():
        return package_root

    cache_root.mkdir(parents=True, exist_ok=True)
    archive = cache_root / f"{ONNXRUNTIME_PACKAGE}.zip"
    if not archive.is_file():
        print(f"Downloading ONNX Runtime {ONNXRUNTIME_VERSION}...")
        with tempfile.NamedTemporaryFile(
            dir=cache_root, suffix=".download", delete=False
        ) as temporary:
            temporary_path = Path(temporary.name)
        try:
            urllib.request.urlretrieve(ONNXRUNTIME_URL, temporary_path)
            temporary_path.replace(archive)
        finally:
            temporary_path.unlink(missing_ok=True)

    print(f"Extracting {archive.name}...")
    with zipfile.ZipFile(archive) as package:
        package.extractall(cache_root)
    if not (package_root / "include" / "onnxruntime_cxx_api.h").is_file():
        raise FileNotFoundError(f"ONNX Runtime 解压结果不完整：{package_root}")
    return package_root


def main():
    cmake = str(find_cmake())
    onnxruntime_root = ensure_onnxruntime()
    for source_dir, build_dir in PROJECTS:
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
        if source_dir.name == "monte-carlo-larc":
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
