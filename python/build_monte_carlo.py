from __future__ import annotations

import argparse
import os
import platform
import shutil
import ssl
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ONNXRUNTIME_VERSION = "1.22.0"
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

CA_BUNDLE_ENVIRONMENT_VARIABLES = (
    "SSL_CERT_FILE",
    "REQUESTS_CA_BUNDLE",
    "CURL_CA_BUNDLE",
)
COMMON_CA_BUNDLES = (
    Path("/etc/ssl/certs/ca-certificates.crt"),
    Path("/etc/pki/tls/certs/ca-bundle.crt"),
    Path("/etc/pki/ca-trust/extracted/pem/tls-ca-bundle.pem"),
    Path("/etc/ssl/ca-bundle.pem"),
    Path("/etc/ssl/cert.pem"),
)


def parse_args() -> argparse.Namespace:
    default_target = "all" if os.name == "nt" else "larc"
    parser = argparse.ArgumentParser(
        description="Build UmaShow recommendation components"
    )
    parser.add_argument(
        "--target",
        choices=("all", "normal", "larc"),
        default=default_target,
        help=("component to build; defaults to all on Windows and larc on Linux"),
    )
    return parser.parse_args()


def onnxruntime_package() -> tuple[str, str, str]:
    machine = platform.machine().lower()
    if os.name == "nt":
        if machine not in {"amd64", "x86_64"}:
            raise RuntimeError(f"不支持的 Windows 架构：{machine}")
        package = f"onnxruntime-directml-win-x64-{ONNXRUNTIME_VERSION}"
        archive = f"microsoft.ml.onnxruntime.directml.{ONNXRUNTIME_VERSION}.nupkg"
        url = (
            "https://api.nuget.org/v3-flatcontainer/"
            f"microsoft.ml.onnxruntime.directml/{ONNXRUNTIME_VERSION}/{archive}"
        )
        return package, archive, url
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
        archive = f"{package}.tgz"
        url = (
            "https://github.com/microsoft/onnxruntime/releases/download/"
            f"v{ONNXRUNTIME_VERSION}/{archive}"
        )
        return package, archive, url
    raise RuntimeError(f"当前系统不支持构建凯旋门推荐组件：{sys.platform}")


def runtime_files(root: Path) -> list[Path]:
    if os.name == "nt":
        library = root / "lib" / "onnxruntime.lib"
        runtime = root / "lib" / "onnxruntime.dll"
        runtimes = sorted((root / "lib").glob("*.dll"))
        return (
            [library, *runtimes]
            if library.is_file() and runtime.is_file()
            else []
        )
    return sorted((root / "lib").glob("libonnxruntime.so*"))


def valid_onnxruntime_root(root: Path) -> bool:
    headers = [(root / "include" / "onnxruntime_cxx_api.h").is_file()]
    if os.name == "nt":
        headers.append((root / "include" / "dml_provider_factory.h").is_file())
    return all(headers) and bool(runtime_files(root))


def extract_onnxruntime(archive: Path, package_root: Path) -> None:
    if os.name != "nt":
        shutil.unpack_archive(archive, package_root.parent)
        return

    extracted = package_root.parent / f"{package_root.name}-nuget"
    if extracted.is_dir():
        shutil.rmtree(extracted)
    with zipfile.ZipFile(archive) as package:
        package.extractall(extracted)

    include = extracted / "build" / "native" / "include"
    runtime = extracted / "runtimes" / "win-x64" / "native"
    if package_root.is_dir():
        shutil.rmtree(package_root)
    shutil.copytree(include, package_root / "include")
    (package_root / "lib").mkdir(parents=True)
    for source in runtime.iterdir():
        if source.suffix.lower() in {".dll", ".lib"}:
            shutil.copy2(source, package_root / "lib" / source.name)


def find_cmake() -> Path:
    explicit = os.environ.get("CMAKE_PATH")
    if explicit and Path(explicit).is_file():
        return Path(explicit)
    candidate = shutil.which("cmake")
    if candidate:
        return Path(candidate)
    raise FileNotFoundError("未找到 CMake；可通过 CMAKE_PATH 指定")


def download_ssl_context() -> ssl.SSLContext:
    context = ssl.create_default_context()
    candidates: list[Path] = []
    for variable in CA_BUNDLE_ENVIRONMENT_VARIABLES:
        value = os.environ.get(variable)
        if not value:
            continue
        candidate = Path(value).expanduser()
        if not candidate.is_file():
            raise FileNotFoundError(f"{variable} 指向的 CA 文件不存在：{candidate}")
        candidates.append(candidate)
    candidates.extend(COMMON_CA_BUNDLES)
    try:
        import certifi

        candidates.append(Path(certifi.where()))
    except ImportError:
        pass

    loaded: set[Path] = set()
    for candidate in candidates:
        try:
            resolved = candidate.resolve()
        except OSError:
            continue
        if resolved in loaded or not resolved.is_file():
            continue
        context.load_verify_locations(cafile=str(resolved))
        loaded.add(resolved)
    return context


def download_file(url: str, destination: Path) -> None:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": f"UmaShow-build/{ONNXRUNTIME_VERSION}"},
    )
    try:
        with urllib.request.urlopen(
            request,
            context=download_ssl_context(),
        ) as response:
            with destination.open("wb") as output:
                shutil.copyfileobj(response, output)
    except urllib.error.HTTPError as error:
        raise RuntimeError(
            f"ONNX Runtime 官方发布文件不存在（HTTP {error.code}）：{url}"
        ) from error
    except urllib.error.URLError as error:
        raise RuntimeError(
            "ONNX Runtime 下载失败。请安装或更新系统 CA 证书，也可以通过 "
            "SSL_CERT_FILE 指定 CA bundle，或通过 ONNXRUNTIME_ARCHIVE "
            "指定手动下载的官方压缩包。"
        ) from error


def ensure_onnxruntime() -> Path:
    package_name, archive_name, download_url = onnxruntime_package()
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
    archive = cache_root / archive_name
    archive_override = os.environ.get("ONNXRUNTIME_ARCHIVE")
    if archive_override:
        source_archive = Path(archive_override).expanduser().resolve()
        if not source_archive.is_file():
            raise FileNotFoundError(
                f"ONNXRUNTIME_ARCHIVE 指向的文件不存在：{source_archive}"
            )
        if source_archive != archive.resolve():
            shutil.copy2(source_archive, archive)
    elif not archive.is_file():
        print(f"Downloading ONNX Runtime {ONNXRUNTIME_VERSION}...")
        with tempfile.NamedTemporaryFile(
            dir=cache_root, suffix=".download", delete=False
        ) as temporary:
            temporary_path = Path(temporary.name)
        try:
            download_file(download_url, temporary_path)
            temporary_path.replace(archive)
        finally:
            temporary_path.unlink(missing_ok=True)

    print(f"Extracting {archive.name}...")
    extract_onnxruntime(archive, package_root)
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
            # CMake caches find_path/find_library results separately from the root.
            configure_command.append("-UUMASHOW_ONNXRUNTIME_*")
            configure_command.append(f"-DUMASHOW_ONNXRUNTIME_ROOT={onnxruntime_root}")

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
