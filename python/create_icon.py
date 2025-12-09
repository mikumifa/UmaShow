import os
from PIL import Image
from icnsutil import IcnsFile

# ====== 配置 ======
SOURCE_IMAGE = "assets/icon.png"  # 原始图片路径
OUTPUT_DIR = "assets\icons"
ICNS_FILE = "assets\icon.icns"

# macOS icns 需要的所有尺寸
SIZES = [
    (16, 16),
    (24, 24),
    (32, 32),
    (64, 64),
    (128, 128),
    (256, 256),
    (512, 512),
    (1024, 1024),
]


def generate_icns(png_paths):
    print("\n⏳ 生成 icon.icns 中…")

    icns = IcnsFile()

    # icns 支持的关键尺寸
    ICON_MAP = {
        16: "icp4",
        32: "icp5",
        64: "icp6",
        128: "ic07",
        256: "ic08",
        512: "ic09",
        1024: "ic10",
    }

    for size, icns_key in ICON_MAP.items():
        path = png_paths[size]
        icns.add_image(icns_key, path)

    icns.write(ICNS_FILE)
    print(f"🎉 完成：{ICNS_FILE}")


def ensure_dirs():
    os.makedirs(OUTPUT_DIR, exist_ok=True)


def generate_pngs():
    img = Image.open(SOURCE_IMAGE).convert("RGBA")

    png_paths = {}

    for w, h in SIZES:
        resized = img.resize((w, h), Image.LANCZOS)
        filename = f"{OUTPUT_DIR}/{w}x{h}.png"
        resized.save(filename)
        png_paths[w] = filename

    return png_paths


def main():
    ensure_dirs()
    pngs = generate_pngs()
    generate_icns(pngs)


if __name__ == "__main__":
    main()
