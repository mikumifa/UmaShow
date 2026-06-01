# -*- coding: utf-8 -*-
import argparse
import base64
import gzip
import json
import sqlite3
import os
import re
from collections import defaultdict
from google.protobuf import json_format
import proto.data_pb2 as data_pb2

SOURCE_ICON_DIR = r"D:\Apps\umas\export\Texture2D"
SUPPORT_CARD_SPECIALTY_RATE_TYPE = 19
SUPPORT_CARD_EFFECT_TYPES = {
    1: "友情加成",
    2: "干劲效果提升",
    3: "速度加成",
    4: "耐力加成",
    5: "力量加成",
    6: "毅力加成",
    7: "智力加成",
    8: "训练效果提升",
    9: "初始速度提升",
    10: "初始耐力提升",
    11: "初始力量提升",
    12: "初始毅力提升",
    13: "初始智力提升",
    14: "初始友情槽提升",
    15: "比赛加成",
    16: "粉丝数加成",
    17: "启发等级提升",
    18: "启发出现率提升",
    19: "擅长率提升",
    25: "事件回复量提升",
    26: "事件效果提升",
    27: "失败率降低",
    28: "体力消耗降低",
    30: "技能点数加成",
    31: "智力友情回复量提升",
}
SUPPORT_CARD_SPECIAL_UNIQUE_EFFECT_TYPES = {
    101: "羁绊达到指定值时追加效果",
    102: "羁绊达到指定值时提升非指定训练类型的训练效果",
    103: "编成支援卡种类达到指定数量时追加效果",
    104: "粉丝数处于指定区间时效果随粉丝数变化",
    105: "根据编成支援卡类型提供对应初始属性加成",
    106: "每次友情训练后叠加友情加成",
    107: "体力越低友情加成越高",
    108: "按指定成长指标动态提高训练效果",
    109: "支援卡羁绊总和越高训练效果越高",
    110: "同时训练的支援卡数量越多训练效果越高",
    111: "当前训练设施等级越高训练效果越高",
    112: "概率将失败率变为0%",
    113: "参与友情训练时追加特殊效果",
    114: "当前体力越高训练效果越高",
    115: "编成支援卡初始羁绊槽提升",
    116: "根据已拥有的某类技能数量提升训练效果",
    117: "总训练设施等级越高训练效果越高",
    118: "羁绊达到指定值时增加训练可同时出现的位置数量",
}
SUPPORT_CARD_ALL_EFFECT_TYPES = {
    **SUPPORT_CARD_EFFECT_TYPES,
    **SUPPORT_CARD_SPECIAL_UNIQUE_EFFECT_TYPES,
}
SUPPORT_CARD_EFFECT_LEVEL_COLUMNS = (
    (1, "init"),
    (5, "limit_lv5"),
    (10, "limit_lv10"),
    (15, "limit_lv15"),
    (20, "limit_lv20"),
    (25, "limit_lv25"),
    (30, "limit_lv30"),
    (35, "limit_lv35"),
    (40, "limit_lv40"),
    (45, "limit_lv45"),
    (50, "limit_lv50"),
)
LIVE_SHOW_CONTEXT_BY_ID = {
    40000: "擅长率 +5",
    40001: "友情加成 +5%",
    40002: "友情加成 +5%",
    40003: "友情加成 +5%",
    40004: "支援卡事件 +1",
    40005: "支援卡事件 +1",
    40006: "支援卡事件 +1",
    40007: "擅长率 +5",
    40008: "擅长率 +5",
    40009: "支援卡事件 +1",
    40010: "支援卡事件 +1",
    40011: "擅长率 +5",
    40012: "友情加成 +5%",
    40013: "擅长率 +5",
    40014: "友情加成 +5%",
    40015: "友情加成 +5%",
    40016: "友情加成 +5%",
    40017: "擅长率 +5",
    40018: "友情加成 +10%",
    40019: "友情加成 +10%",
    40020: "支援卡事件 +1",
}


def open_db(path: str) -> sqlite3.Cursor:
    connection = sqlite3.connect(path)
    return connection.cursor()


def populate_charas(pb: data_pb2.UMDatabase, cursor: sqlite3.Cursor):
    cursor.execute("""SELECT t1."index", t1.text, t2.text FROM text_data AS t1
                      LEFT JOIN text_data AS t2 on t1."index"=t2."index"
                      WHERE t1.category=170 AND t2.category=7;""")
    rows = cursor.fetchall()

    for row in rows:
        c = data_pb2.Chara()
        c.id = row[0]
        c.name = row[1]
        c.cast_name = row[2]
        icon_filename = f"chr_icon_training_{c.id}.png"
        icon_path = os.path.join(SOURCE_ICON_DIR, icon_filename)

        if os.path.exists(icon_path):
            try:
                with open(icon_path, "rb") as img_file:
                    img_data = img_file.read()
                    base64_bytes = base64.b64encode(img_data)
                    base64_string = base64_bytes.decode("utf-8")
                    # 设置 Base64 Data URI
                    c.icon_url = f"data:image/png;base64,{base64_string}"
            except Exception as e:
                print(f"Error encoding image for chara {c.id}: {e}")
        else:
            pass

        pb.chara.append(c)


def populate_cards(pb: data_pb2.UMDatabase, cursor: sqlite3.Cursor):
    cursor.execute("SELECT `index`, text FROM text_data WHERE category=5;")
    rows = cursor.fetchall()
    for row in rows:
        c = data_pb2.Card()
        c.id = row[0]
        c.name = row[1]
        pb.card.append(c)


def populate_support_cards(pb: data_pb2.UMDatabase, cursor: sqlite3.Cursor):
    cursor.execute("""SELECT s.id, t.text, s.chara_id, s.command_id
                      FROM support_card_data AS s
                      JOIN text_data AS t ON t."index"=s.id AND t.category=75;""")
    rows = cursor.fetchall()
    for row in rows:
        c = data_pb2.SupportCard()
        c.id = row[0]
        c.name = row[1]
        c.chara_id = row[2]
        c.command_id = row[3]
        pb.support_card.append(c)


def build_support_card_meta(cursor: sqlite3.Cursor) -> dict:
    support_card_meta = {}
    default_effect_values = {
        str(level): -1 for level, _ in SUPPORT_CARD_EFFECT_LEVEL_COLUMNS
    }
    default_effects = {
        str(effect_type): dict(default_effect_values)
        for effect_type in SUPPORT_CARD_EFFECT_TYPES
    }

    cursor.execute(
        """SELECT id, rarity, effect_table_id, unique_effect_id
           FROM support_card_data;"""
    )
    for support_card_id, rarity, effect_table_id, unique_effect_id in cursor.fetchall():
        support_card_meta[support_card_id] = {
            "rarity": rarity,
            "effectTableId": effect_table_id,
            "uniqueEffectId": unique_effect_id,
            "effectValues": {
                effect_type: dict(values)
                for effect_type, values in default_effects.items()
            },
            "uniqueEffects": {},
            "specialtyRateEffectValues": dict(default_effect_values),
            "specialtyRateUnique": None,
        }

    cursor.execute(
        """SELECT id, type, init, limit_lv5, limit_lv10, limit_lv15, limit_lv20,
                  limit_lv25, limit_lv30, limit_lv35, limit_lv40, limit_lv45, limit_lv50
           FROM support_card_effect_table
           WHERE type IN ({placeholders});""".format(
            placeholders=",".join("?" for _ in SUPPORT_CARD_EFFECT_TYPES)
        ),
        tuple(SUPPORT_CARD_EFFECT_TYPES),
    )
    for row in cursor.fetchall():
        effect_id = row[0]
        effect_type = str(row[1])
        values = {
            str(level): value
            for (level, _), value in zip(SUPPORT_CARD_EFFECT_LEVEL_COLUMNS, row[2:])
        }
        for support_card in support_card_meta.values():
            if support_card["effectTableId"] != effect_id:
                continue
            support_card["effectValues"][effect_type] = values
            if effect_type == str(SUPPORT_CARD_SPECIALTY_RATE_TYPE):
                support_card["specialtyRateEffectValues"] = dict(values)

    cursor.execute(
        """SELECT id, lv,
                  type_0, value_0, value_0_1, value_0_2, value_0_3, value_0_4,
                  type_1, value_1, value_1_1, value_1_2, value_1_3, value_1_4
           FROM support_card_unique_effect;"""
    )
    for (
        unique_effect_id,
        activation_level,
        type_0,
        value_0,
        value_0_1,
        value_0_2,
        value_0_3,
        value_0_4,
        type_1,
        value_1,
        value_1_1,
        value_1_2,
        value_1_3,
        value_1_4,
    ) in cursor.fetchall():
        unique_effects = {}
        for effect_type, effect_value, effect_value_1, effect_value_2, effect_value_3, effect_value_4 in (
            (type_0, value_0, value_0_1, value_0_2, value_0_3, value_0_4),
            (type_1, value_1, value_1_1, value_1_2, value_1_3, value_1_4),
        ):
            if effect_type > 0:
                unique_effects[str(effect_type)] = {
                    "type": effect_type,
                    "level": activation_level,
                    "value": effect_value,
                    "value1": effect_value_1,
                    "value2": effect_value_2,
                    "value3": effect_value_3,
                    "value4": effect_value_4,
                }

        if not unique_effects:
            continue

        for support_card in support_card_meta.values():
            if support_card["uniqueEffectId"] == unique_effect_id:
                support_card["uniqueEffects"] = dict(unique_effects)
                specialty_rate_unique = unique_effects.get(
                    str(SUPPORT_CARD_SPECIALTY_RATE_TYPE)
                )
                if specialty_rate_unique is not None:
                    support_card["specialtyRateUnique"] = specialty_rate_unique

    cursor.execute(
        """SELECT rarity, level, total_exp
           FROM support_card_level
           ORDER BY rarity, level;"""
    )
    support_card_levels = defaultdict(dict)
    for rarity, level, total_exp in cursor.fetchall():
        support_card_levels[str(rarity)][str(level)] = total_exp

    for support_card in support_card_meta.values():
        support_card.pop("effectTableId", None)
        support_card.pop("uniqueEffectId", None)

    return {
        "supportCardMeta": {
            str(support_card_id): meta
            for support_card_id, meta in support_card_meta.items()
        },
        "supportCardEffectTypes": {
            str(effect_type): name
            for effect_type, name in SUPPORT_CARD_ALL_EFFECT_TYPES.items()
        },
        "supportCardLevels": dict(support_card_levels),
    }


def build_chara_effect_texts(cursor: sqlite3.Cursor) -> dict:
    cursor.execute('SELECT "index", text FROM text_data WHERE category=142;')
    return {str(effect_id): text for effect_id, text in cursor.fetchall()}


def normalize_skill_tip_name(name: str) -> str:
    return re.sub(r"[◎○×]$", "", name).strip()


def build_skill_tip_names(cursor: sqlite3.Cursor) -> dict:
    cursor.execute(
        """SELECT s.group_id, s.rarity, t.text
           FROM skill_data AS s
           JOIN text_data AS t ON t."index"=s.id AND t.category=47
           ORDER BY s.group_id, s.rarity, s.id;"""
    )
    grouped_names = defaultdict(lambda: defaultdict(list))
    for group_id, rarity, text in cursor.fetchall():
        if not text:
            continue
        grouped_names[str(group_id)][str(rarity)].append(text)

    result = {}
    for group_id, rarity_map in grouped_names.items():
        result[group_id] = {}
        for rarity, names in rarity_map.items():
            unique_names = list(dict.fromkeys(names))
            if len(unique_names) == 1:
                result[group_id][rarity] = unique_names[0]
                continue

            normalized_names = [normalize_skill_tip_name(name) for name in unique_names]
            if len(set(normalized_names)) == 1:
                result[group_id][rarity] = normalized_names[0]
            else:
                result[group_id][rarity] = unique_names[0]

    return result


def build_card_talent_rates(cursor: sqlite3.Cursor) -> dict:
    cursor.execute(
        """SELECT id, talent_speed, talent_stamina, talent_pow, talent_guts, talent_wiz
           FROM card_data;"""
    )
    return {
        str(card_id): {
            "speed": talent_speed or 0,
            "stamina": talent_stamina or 0,
            "power": talent_pow or 0,
            "guts": talent_guts or 0,
            "wiz": talent_wiz or 0,
        }
        for (
            card_id,
            talent_speed,
            talent_stamina,
            talent_pow,
            talent_guts,
            talent_wiz,
        ) in cursor.fetchall()
    }


def populate_succession_relation(pb: data_pb2.UMDatabase, cursor: sqlite3.Cursor):
    relations = {}

    cursor.execute("SELECT relation_type, relation_point FROM succession_relation;")
    rows = cursor.fetchall()
    for row in rows:
        r = data_pb2.SuccessionRelation()
        r.relation_type = row[0]
        r.relation_point = row[1]
        relations[r.relation_type] = r

    cursor.execute(
        "SELECT id, relation_type, chara_id FROM succession_relation_member ORDER BY id;"
    )
    rows = cursor.fetchall()
    for row in rows:
        member = data_pb2.SuccessionRelation.Member()
        member.id = row[0]
        member.chara_id = row[2]
        relations[row[1]].member.append(member)

    pb.succession_relation.extend(relations.values())


def populate_race_instance(pb: data_pb2.UMDatabase, cursor: sqlite3.Cursor):
    cursor.execute("""SELECT ri.id, rcs.distance, rcs.ground, t.text
                      FROM race_instance AS ri
                      LEFT JOIN race AS r ON ri.race_id = r.id
                      LEFT JOIN race_course_set AS rcs ON r.course_set = rcs.id
                      LEFT JOIN text_data AS t ON t."index" = ri.id AND t.category = 29;""")
    rows = cursor.fetchall()
    for row in rows:
        r = data_pb2.RaceInstance()
        r.id = row[0]
        r.distance = row[1]
        r.ground_type = row[2]
        r.name = row[3] or "Unknown"
        pb.race_instance.append(r)


def populate_wins_saddle(pb: data_pb2.UMDatabase, cursor: sqlite3.Cursor):
    instance_id_columns = ", ".join(["s.race_instance_id_%d" % i for i in range(1, 9)])
    cursor.execute(
        """SELECT s.id, t.text, s.priority, s.group_id, s.win_saddle_type, %s
                      FROM single_mode_wins_saddle AS s
                      JOIN text_data AS t
                      ON t.category=111 AND s.id = t."index";"""
        % instance_id_columns
    )
    rows = cursor.fetchall()
    for row in rows:
        w = data_pb2.WinsSaddle()
        w.id = row[0]
        w.name = row[1]
        w.priority = row[2]
        w.group_id = row[3]
        w.type = row[4]
        w.race_instance_id.extend([i for i in row[5:] if i > 0])
        pb.wins_saddle.append(w)


def populate_special_case_race(pb: data_pb2.UMDatabase, cursor: sqlite3.Cursor):
    cursor.execute("""SELECT p1.race_instance_id, p1.program_group, p1.race_permission
                      FROM single_mode_program AS p1
                      INNER JOIN single_mode_program AS p2
                      ON p1.base_program_id != 0 AND p2.base_program_id = 0
                          AND p1.base_program_id = p2.id
                          AND p1.race_instance_id != p2.race_instance_id;""")
    rows = cursor.fetchall()
    races = []
    groups_to_query = set()
    for row in rows:
        race = data_pb2.SpecialCaseRace()
        race.race_instance_id = row[0]
        race.program_group = row[1]
        race.race_permission = row[2]
        races.append(race)
        groups_to_query.add(str(race.program_group))

    if groups_to_query:
        cursor.execute(
            """SELECT chara_id, program_group FROM single_mode_chara_program
                          WHERE program_group IN (%s);"""
            % ", ".join(groups_to_query)
        )
        rows = cursor.fetchall()
        groups = defaultdict(list)
        for row in rows:
            groups[row[1]].append(row[0])

        for race in races:
            race.chara_id.extend(groups[race.program_group])
            pb.special_case_race.append(race)


def populate_skills(pb: data_pb2.UMDatabase, cursor: sqlite3.Cursor):
    cursor.execute("""SELECT s.id, t.text, s.grade_value, s.tag_id
                      FROM skill_data AS s
                      JOIN text_data AS t ON t."index"=s.id AND t.category=47;""")
    rows = cursor.fetchall()
    for row in rows:
        r = data_pb2.Skill()
        r.id = row[0]
        r.name = row[1]
        r.grade_value = row[2]
        r.tag_id.extend(row[3].split("/"))
        pb.skill.append(r)


def populate_team_stadium_score_bonus(pb: data_pb2.UMDatabase, cursor: sqlite3.Cursor):
    cursor.execute("SELECT `index`, text FROM text_data WHERE category=148;")
    rows = cursor.fetchall()
    for row in rows:
        r = data_pb2.TeamStadiumScoreBonus()
        r.id = row[0]
        r.name = row[1]
        pb.team_stadium_score_bonus.append(r)


def populate_stories(pb: data_pb2.UMDatabase, cursor: sqlite3.Cursor):
    cursor.execute("SELECT `index`, text FROM text_data WHERE category=181;")
    rows = cursor.fetchall()
    for row in rows:
        r = data_pb2.Story()
        r.id = row[0]
        r.name = row[1]
        pb.story.append(r)


def populate_live_songs(pb: data_pb2.UMDatabase, cursor: sqlite3.Cursor):
    cursor.execute(
        """SELECT s.id,
                  s.square_title_text_id,
                  tt.text,
                  s.square_content_text_id,
                  tc.text,
                  s.master_bonus_id,
                  s.square_type,
                  s.perf_type_1, s.perf_value_1,
                  s.perf_type_2, s.perf_value_2,
                  s.perf_type_3, s.perf_value_3,
                  s.perf_type_4, s.perf_value_4,
                  s.perf_type_5, s.perf_value_5
           FROM single_mode_live_square AS s
           LEFT JOIN text_data AS tt
             ON tt.category=209 AND tt."index"=s.square_title_text_id
           LEFT JOIN text_data AS tc
             ON tc.category=207 AND tc."index"=s.square_content_text_id;"""
    )
    rows = cursor.fetchall()
    for row in rows:
        r = data_pb2.LiveSong()
        r.id = row[0]
        r.square_title = row[2]
        r.square_content = row[4]
        r.master_bonus_id = row[5]
        r.square_type = row[6]
        perf_pairs = [(row[i], row[i + 1]) for i in range(7, 17, 2)]
        for perf_type, perf_value in perf_pairs:
            if perf_type <= 0:
                break
            r.perf_type.append(perf_type)
            r.perf_value.append(perf_value)
        if r.id in LIVE_SHOW_CONTEXT_BY_ID:
            r.live_show_context = LIVE_SHOW_CONTEXT_BY_ID[r.id]
        pb.live_song.append(r)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--db_path", default="master.mdb")
    parser.add_argument("--version", default="test")
    args = parser.parse_args()

    pb = data_pb2.UMDatabase()
    pb.version = args.version

    cursor = open_db(args.db_path)

    for p in (
        populate_charas,
        populate_cards,
        populate_support_cards,
        populate_succession_relation,
        populate_race_instance,
        populate_wins_saddle,
        populate_special_case_race,
        populate_skills,
        populate_team_stadium_score_bonus,
        populate_stories,
        populate_live_songs,
    ):
        p(pb, cursor)
    support_card_meta = build_support_card_meta(cursor)
    chara_effect_texts = build_chara_effect_texts(cursor)
    skill_tip_names = build_skill_tip_names(cursor)
    card_talent_rates = build_card_talent_rates(cursor)
    os.makedirs("assets/data", exist_ok=True)
    with open("assets/data/umdb.binarypb.gz", "wb") as f:
        f.write(gzip.compress(pb.SerializeToString(), mtime=0))
    umdb_json = json_format.MessageToDict(pb)
    for support_card in umdb_json.get("supportCard", []):
        support_card_id = str(support_card["id"])
        support_card.update(
            support_card_meta["supportCardMeta"].get(
                support_card_id,
                {
                    "effectValues": {
                        str(effect_type): {
                            str(level): -1
                            for level, _ in SUPPORT_CARD_EFFECT_LEVEL_COLUMNS
                        }
                        for effect_type in SUPPORT_CARD_EFFECT_TYPES
                    },
                    "uniqueEffects": {},
                    "specialtyRateEffectValues": {
                        str(level): -1
                        for level, _ in SUPPORT_CARD_EFFECT_LEVEL_COLUMNS
                    },
                    "specialtyRateUnique": None,
                },
            )
        )
    umdb_json["supportCardLevels"] = support_card_meta["supportCardLevels"]
    umdb_json["charaEffectTexts"] = chara_effect_texts
    umdb_json["skillTipNames"] = skill_tip_names
    umdb_json["cardTalentRates"] = card_talent_rates
    with open("assets/data/umdb.json", "w", encoding="utf-8") as f:
        json.dump(umdb_json, f, ensure_ascii=False, indent=2)
    for support_card_meta_path in (
        "assets/data/support_card_meta.json",
        "support_card_meta.generated.json",
    ):
        with open(support_card_meta_path, "w", encoding="utf-8") as f:
            json.dump(support_card_meta, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
