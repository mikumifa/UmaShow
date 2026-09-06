from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
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


def main():
    cmake = str(find_cmake())
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
