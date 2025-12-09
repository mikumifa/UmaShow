import os
import shutil
import re

SOURCE_DIR = "D:\\Apps\\umas\\export\\Texture2D"
TARGET_DIR = "./assets/chr_icon"

os.makedirs(TARGET_DIR, exist_ok=True)
pattern = re.compile(r"chr_icon_training_(\d+)\.png$")

for filename in os.listdir(SOURCE_DIR):
    match = pattern.match(filename)
    if not match:
        continue

    chara_id = match.group(1)
    src_path = os.path.join(SOURCE_DIR, filename)
    dst_path = os.path.join(TARGET_DIR, f"{chara_id}.png")

    shutil.copy2(src_path, dst_path)
    print(f"Copied: {filename} → {chara_id}.png")

print("Done.")
