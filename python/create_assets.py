import os
import shutil
import re

SOURCE_DIR = "D:\\Apps\\umas\\export\\Texture2D"
CHARA_ICON_TARGET_DIR = "./assets/chr_icon"
TRAINED_CHR_ICON_TARGET_DIR = "./assets/trained_chr_icon"
SUPPORT_CARD_S_TARGET_DIR = "./assets/support_card_s"

for target_dir in (
    CHARA_ICON_TARGET_DIR,
    TRAINED_CHR_ICON_TARGET_DIR,
    SUPPORT_CARD_S_TARGET_DIR,
):
    if not os.path.exists(target_dir):
        os.makedirs(target_dir)

chara_icon_pattern = re.compile(r"chr_icon_training_(\d+)\.png$")
trained_chara_icon_pattern = re.compile(
    r"trained_chr_icon_(\d+)_(\d+)_02\.png$"
)
support_card_s_pattern = re.compile(r"support_card_s_(\d+)\.png$")

for filename in os.listdir(SOURCE_DIR):
    src_path = os.path.join(SOURCE_DIR, filename)

    chara_icon_match = chara_icon_pattern.match(filename)
    if chara_icon_match:
        chara_id = chara_icon_match.group(1)
        dst_path = os.path.join(CHARA_ICON_TARGET_DIR, "{}.png".format(chara_id))
        shutil.copy2(src_path, dst_path)
        print("Copied chara icon: {} -> {}.png".format(filename, chara_id))
        continue

    trained_chara_icon_match = trained_chara_icon_pattern.match(filename)
    if trained_chara_icon_match:
        chara_id = trained_chara_icon_match.group(1)
        race_dress_id = trained_chara_icon_match.group(2)
        dst_filename = "{}_{}.png".format(chara_id, race_dress_id)
        dst_path = os.path.join(TRAINED_CHR_ICON_TARGET_DIR, dst_filename)
        shutil.copy2(src_path, dst_path)
        print("Copied trained chara icon: {} -> {}".format(filename, dst_filename))
        continue

    support_card_s_match = support_card_s_pattern.match(filename)
    if support_card_s_match:
        support_card_id = support_card_s_match.group(1)
        dst_filename = "{}.png".format(support_card_id)
        dst_path = os.path.join(SUPPORT_CARD_S_TARGET_DIR, dst_filename)
        shutil.copy2(src_path, dst_path)
        print("Copied support card icon: {} -> {}".format(filename, dst_filename))

print("Done.")
