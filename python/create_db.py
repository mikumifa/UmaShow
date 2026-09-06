# -*- coding: utf-8 -*-
from __future__ import annotations

import argparse
import base64
import gzip
import json
import sqlite3
import os
import re
from collections import defaultdict

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

MONTE_CARLO_DIRECT_MERGE_CARDS = {30128, 30155, 30171}
MONTE_CARLO_HINT_VALUES = (
    (6, 0, 2, 0, 0, 0),
    (0, 6, 0, 2, 0, 0),
    (0, 2, 6, 0, 0, 0),
    (1, 0, 1, 6, 0, 0),
    (2, 0, 0, 0, 6, 0),
)
MONTE_CARLO_SPECIAL_RACES = {
    1005: {"races": [32, 45]},
    1009: {"races": [33]},
    1016: {"races": [55, 67, 69, 71]},
    1022: {"freeRaces": [{"startTurn": 67, "endTurn": 71, "count": 1}]},
    1031: {"freeRaces": [{"startTurn": 69, "endTurn": 71, "count": 1}]},
    1032: {"races": [33]},
    1056: {
        "races": [29],
        "freeRaces": [{"startTurn": 60, "endTurn": 63, "count": 1}],
    },
    1069: {"races": [58]},
    1071: {"races": [43]},
    1079: {"races": [53]},
    1093: {"races": [41]},
    1109: {"races": [32]},
    1116: {"races": [71]},
    1121: {"races": [41]},
}
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

SCENARIO_SKILLS = {
    210011,
    210012,
    210021,
    210022,
    210031,
    210032,
    210041,
    210042,
    210051,
    210052,
    210061,
    210062,
    210071,
    210072,
    210081,
    210082,
    210261,
    210262,
    210271,
    210272,
    210281,
    210282,
    210291,
}
SPLIT_ALTERNATIVE_SKILL_IDS = {100701, 900701}


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


def _monte_carlo_interpolate(values: dict) -> list[int]:
    """Expand sparse level-5 effect values to 0/5/.../50 like UmaAi."""
    raw = [int(values.get(str(level), -1)) for level, _ in SUPPORT_CARD_EFFECT_LEVEL_COLUMNS]
    populated = [(index, value) for index, value in enumerate(raw) if value != -1]
    if not populated:
        return [0] * len(raw)

    result = [0] * len(raw)
    first_index, first_value = populated[0]
    for index in range(first_index + 1):
        result[index] = first_value if index == first_index else 0
    for (left_index, left_value), (right_index, right_value) in zip(
        populated, populated[1:]
    ):
        result[left_index] = left_value
        distance = right_index - left_index
        for index in range(left_index + 1, right_index):
            ratio = (index - left_index) / distance
            result[index] = int(left_value + (right_value - left_value) * ratio)
        result[right_index] = right_value
    last_index, last_value = populated[-1]
    for index in range(last_index, len(raw)):
        result[index] = last_value
    return result


def _monte_carlo_merge_effect(card_value: dict, effect_type: int, value: int):
    if effect_type == 41:
        for index in range(5):
            card_value["bonus"][index] += 1
    elif effect_type == 1:
        base = card_value.get("youQing", 0)
        card_value["youQing"] = (100 + value) * (100 + base) / 100 - 100
    elif effect_type == 2:
        card_value["ganJing"] = card_value.get("ganJing", 0) + value
    elif 3 <= effect_type <= 7:
        card_value["bonus"][effect_type - 3] += value
    elif effect_type == 8:
        card_value["xunLian"] = card_value.get("xunLian", 0) + value
    elif 9 <= effect_type <= 13:
        card_value["initialBonus"][effect_type - 9] += value
    elif effect_type == 14:
        card_value["initialJiBan"] = card_value.get("initialJiBan", 0) + value
    elif effect_type == 15:
        card_value["saiHou"] = card_value.get("saiHou", 0) + value
    elif effect_type == 17:
        card_value["hintBonus"][5] += value * 5
    elif effect_type == 19:
        base = card_value.get("deYiLv", 0)
        card_value["deYiLv"] = (100 + value) * (100 + base) / 100 - 100
    elif effect_type == 27:
        base = card_value.get("failRateDrop", 0)
        card_value["failRateDrop"] = 100 - (100 - base) * (100 - value) / 100
    elif effect_type == 28:
        base = card_value.get("vitalCostDrop", 0)
        card_value["vitalCostDrop"] = 100 - (100 - base) * (100 - value) / 100
    elif effect_type == 30:
        card_value["bonus"][5] += value
    elif effect_type == 31:
        card_value["wizVitalBonus"] = card_value.get("wizVitalBonus", 0) + value


def _monte_carlo_prepare_unique(card: dict, unique_effects: dict):
    effects = [value for value in unique_effects.values() if isinstance(value, dict)]
    special = next((effect for effect in effects if int(effect.get("type", 0)) >= 100), None)
    base_effects = [effect for effect in effects if 0 < int(effect.get("type", 0)) < 100]

    if special is None or card["cardId"] in MONTE_CARLO_DIRECT_MERGE_CARDS:
        for card_value in card["cardValue"]:
            for effect in base_effects:
                _monte_carlo_merge_effect(
                    card_value, int(effect.get("type", 0)), int(effect.get("value", 0))
                )
        card["uniqueEffectType"] = 0
        return

    source_type = int(special.get("type", 0))
    params = [
        source_type,
        int(special.get("value", 0)),
        int(special.get("value1", 0)),
        int(special.get("value2", 0)),
        int(special.get("value3", 0)),
        int(special.get("value4", 0)),
    ]
    if source_type == 101:
        mapped_type = 1 if params[1] == 80 else 2 if params[1] == 100 else 0
    elif source_type == 102:
        mapped_type = 3
    elif source_type == 103:
        mapped_type = 21
        params[3] = params[2]
        params[2] = 8
    elif source_type <= 120:
        mapped_type = source_type - 100
    else:
        mapped_type = source_type - 99
    card["uniqueEffectType"] = mapped_type
    card["uniqueEffectParam"] = params


def build_monte_carlo_support_cards(
    cursor: sqlite3.Cursor, support_card_meta: dict
) -> dict:
    cursor.execute(
        """SELECT s.id, s.chara_id, s.rarity, s.command_id, s.support_card_type,
                  COALESCE(t.text, '')
           FROM support_card_data AS s
           LEFT JOIN text_data AS t ON t.category=75 AND t."index"=s.id;"""
    )
    cursor.execute(
        "SELECT support_card_id, COUNT(*) FROM single_mode_hint_gain "
        "WHERE hint_gain_type=0 GROUP BY support_card_id;"
    )
    hint_counts = {int(card_id): int(count) for card_id, count in cursor.fetchall()}

    # Re-run the identity query because sqlite cursors only hold one result set.
    cursor.execute(
        """SELECT s.id, s.chara_id, s.rarity, s.command_id, s.support_card_type,
                  COALESCE(t.text, '')
           FROM support_card_data AS s
           LEFT JOIN text_data AS t ON t.category=75 AND t."index"=s.id;"""
    )
    result = {}
    for card_id, chara_id, rarity, command_id, support_type, name in cursor.fetchall():
        if support_type == 1:
            card_type = {101: 0, 105: 1, 102: 2, 103: 3, 106: 4}.get(command_id, 0)
        elif support_type == 2:
            card_type = 5
        else:
            card_type = 6
        meta = support_card_meta["supportCardMeta"].get(str(card_id), {})
        effect_values = meta.get("effectValues", {})
        start_index = 3 + int(rarity)
        expanded = {
            int(effect_type): _monte_carlo_interpolate(level_values)
            for effect_type, level_values in effect_values.items()
        }
        card_values = []
        for break_index in range(5):
            source_index = min(10, start_index + break_index)
            value = {
                "filled": True,
                "bonus": [0, 0, 0, 0, 0, 0],
                "initialBonus": [0, 0, 0, 0, 0, 0],
                "hintBonus": [0, 0, 0, 0, 0, 5],
                "hintLevel": 0,
            }
            for effect_type, values in expanded.items():
                effect_value = values[source_index]
                if effect_type in (1, 2, 8, 14, 15, 18, 19, 25, 26, 27, 28, 31):
                    key = {
                        1: "youQing",
                        2: "ganJing",
                        8: "xunLian",
                        14: "initialJiBan",
                        15: "saiHou",
                        18: "hintProbIncrease",
                        19: "deYiLv",
                        25: "eventRecoveryAmountUp",
                        26: "eventEffectUp",
                        27: "failRateDrop",
                        28: "vitalCostDrop",
                        31: "wizVitalBonus",
                    }[effect_type]
                    value[key] = effect_value
                elif 3 <= effect_type <= 7:
                    value["bonus"][effect_type - 3] = effect_value
                elif 9 <= effect_type <= 13:
                    value["initialBonus"][effect_type - 9] = effect_value
                elif effect_type == 17:
                    value["hintBonus"][5] += 5 * effect_value
                    value["hintLevel"] = effect_value + 1
                elif effect_type == 30:
                    value["bonus"][5] = effect_value
            card_values.append(value)
        card = {
            "cardId": int(card_id),
            "charaId": int(chara_id),
            "cardName": name,
            "rarity": int(rarity),
            "cardType": card_type,
            "cardValue": card_values,
        }
        _monte_carlo_prepare_unique(card, meta.get("uniqueEffects", {}))
        if hint_counts.get(int(card_id), 0) == 0 and card_type < 5:
            for value in card_values:
                value["hintBonus"] = list(MONTE_CARLO_HINT_VALUES[card_type])
                value["hintLevel"] = 0
        result[str(card_id)] = card
    return result


def build_monte_carlo_umas(cursor: sqlite3.Cursor) -> dict:
    cursor.execute(
        """SELECT c.id, c.chara_id, c.talent_speed, c.talent_stamina,
                  c.talent_pow, c.talent_guts, c.talent_wiz,
                  r.speed, r.stamina, r.pow, r.guts, r.wiz,
                  COALESCE(t.text, '')
           FROM card_data AS c
           JOIN card_rarity_data AS r ON r.card_id=c.id AND r.rarity=5
           LEFT JOIN text_data AS t ON t.category=4 AND t."index"=c.id
           WHERE c.default_rarity != 0;"""
    )
    rows = cursor.fetchall()
    result = {}
    for row in rows:
        card_id, chara_id = int(row[0]), int(row[1])
        cursor.execute(
            """SELECT turn, condition_type, condition_id, condition_value_1,
                      condition_value_2, determine_race
               FROM single_mode_route_race
               WHERE race_set_id=? AND scenario_group_id=100
               ORDER BY turn, sort_id;""",
            (chara_id,),
        )
        races = []
        free_races = []
        last_race = -1
        for turn, condition_type, condition_id, _rank, count, determine_race in cursor.fetchall():
            if condition_type == 1 and determine_race == 0:
                adjusted = int(turn) - 1
                if adjusted not in races:
                    races.append(adjusted)
            elif condition_type in (2, 3):
                free_races.append(
                    {"startTurn": last_race, "endTurn": int(turn) - 1, "count": int(count or 1)}
                )
            last_race = int(turn)
        special = MONTE_CARLO_SPECIAL_RACES.get(chara_id, {})
        races.extend(special.get("races", []))
        free_races.extend(special.get("freeRaces", []))
        result[str(card_id)] = {
            "bonusData": [],
            "fiveStatusBonus": [int(value or 0) for value in row[2:7]],
            "fiveStatusInitial": [int(value or 0) for value in row[7:12]],
            "freeRaces": sorted(free_races, key=lambda item: item["startTurn"]),
            "gameId": card_id,
            "name": row[12],
            "preferRaces": [],
            "preferReds": [],
            "races": sorted(set(races)),
            "star": 5,
        }
    return result


def build_monte_carlo_data(cursor: sqlite3.Cursor, support_card_meta: dict) -> dict:
    return {
        "version": 1,
        "umas": build_monte_carlo_umas(cursor),
        "supportCards": build_monte_carlo_support_cards(cursor, support_card_meta),
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


def build_card_rarity_data(cursor: sqlite3.Cursor) -> dict:
    cursor.execute(
        """SELECT card_id, rarity, race_dress_id
           FROM card_rarity_data
           ORDER BY card_id, rarity;"""
    )
    result = defaultdict(dict)
    for card_id, rarity, race_dress_id in cursor.fetchall():
        result[str(card_id)][str(rarity)] = race_dress_id
    return dict(result)


def build_arc_rival_dress_ids(cursor: sqlite3.Cursor) -> dict:
    """Resolve the costume portrait used by Arc scenario members."""
    cursor.execute(
        """SELECT chara_id, race_dress_id
           FROM single_mode_scout_chara
           ORDER BY id;"""
    )
    result = {}
    for chara_id, race_dress_id in cursor.fetchall():
        # 101 is the common placeholder dress and has no trained portrait.
        if race_dress_id >= 100000:
            result.setdefault(str(chara_id), race_dress_id)

    # Newer scout entries can still use the placeholder dress. Use the
    # character's first playable costume so Arc members still get a costume
    # portrait instead of falling back to chr_icon_training.
    cursor.execute(
        """SELECT c.chara_id, r.race_dress_id
           FROM card_data AS c
           JOIN card_rarity_data AS r ON r.card_id = c.id
           WHERE r.rarity = 3 AND r.race_dress_id >= 100000
           ORDER BY c.chara_id, c.id;"""
    )
    for chara_id, race_dress_id in cursor.fetchall():
        result.setdefault(str(chara_id), race_dress_id)

    return result


def build_skill_data(cursor: sqlite3.Cursor) -> dict:
    cursor.execute(
        """
SELECT id, rarity,
       condition_1,
       float_ability_time_1, precondition_1,
       ability_type_1_1, float_ability_value_1_1, target_type_1_1,
       ability_type_1_2, float_ability_value_1_2, target_type_1_2,
       ability_type_1_3, float_ability_value_1_3, target_type_1_3,
       condition_2,
       float_ability_time_2, precondition_2,
       ability_type_2_1, float_ability_value_2_1, target_type_2_1,
       ability_type_2_2, float_ability_value_2_2, target_type_2_2,
       ability_type_2_3, float_ability_value_2_3, target_type_2_3
  FROM skill_data;
"""
    )

    def patch_modifier(skill_id: int, value, ability_type):
        if value is None:
            return value
        try:
            patched = float(value)
        except Exception:
            patched = value
        if skill_id in SCENARIO_SKILLS:
            try:
                if skill_id == 210061 and ability_type in (31, 9):
                    return patched
                return patched * 1.2
            except Exception:
                return patched
        return patched

    def build_effects(skill_id: int, triplets) -> list:
        effects = []
        for ability_type, modifier, target_type in triplets:
            if ability_type is None or ability_type == 0:
                continue
            effects.append(
                {
                    "type": ability_type,
                    "modifier": patch_modifier(skill_id, modifier or 0, ability_type),
                    "target": target_type,
                }
            )
        return effects

    skill_data = {}
    for row in cursor.fetchall():
        (
            skill_id,
            rarity,
            condition_1,
            float_ability_time_1,
            precondition_1,
            ability_type_1_1,
            float_ability_value_1_1,
            target_type_1_1,
            ability_type_1_2,
            float_ability_value_1_2,
            target_type_1_2,
            ability_type_1_3,
            float_ability_value_1_3,
            target_type_1_3,
            condition_2,
            float_ability_time_2,
            precondition_2,
            ability_type_2_1,
            float_ability_value_2_1,
            target_type_2_1,
            ability_type_2_2,
            float_ability_value_2_2,
            target_type_2_2,
            ability_type_2_3,
            float_ability_value_2_3,
            target_type_2_3,
        ) = row

        skill_id = int(skill_id)
        rarity = int(rarity) if rarity is not None else 0

        alternatives = [
            {
                "precondition": precondition_1 or "",
                "condition": condition_1 or "",
                "baseDuration": float_ability_time_1 or 0,
                "effects": build_effects(
                    skill_id,
                    (
                        (
                            ability_type_1_1,
                            float_ability_value_1_1,
                            target_type_1_1,
                        ),
                        (
                            ability_type_1_2,
                            float_ability_value_1_2,
                            target_type_1_2,
                        ),
                        (
                            ability_type_1_3,
                            float_ability_value_1_3,
                            target_type_1_3,
                        ),
                    ),
                ),
            }
        ]

        if condition_2 is not None and str(condition_2) not in ("", "0"):
            alternatives.append(
                {
                    "precondition": precondition_2 or "",
                    "condition": condition_2,
                    "baseDuration": float_ability_time_2 or 0,
                    "effects": build_effects(
                        skill_id,
                        (
                            (
                                ability_type_2_1,
                                float_ability_value_2_1,
                                target_type_2_1,
                            ),
                            (
                                ability_type_2_2,
                                float_ability_value_2_2,
                                target_type_2_2,
                            ),
                            (
                                ability_type_2_3,
                                float_ability_value_2_3,
                                target_type_2_3,
                            ),
                        ),
                    ),
                }
            )

        if skill_id in SPLIT_ALTERNATIVE_SKILL_IDS:
            discriminators = [""] + [f"-{i}" for i in range(1, len(alternatives))]
            for discriminator, alternative in zip(discriminators, alternatives):
                skill_data[f"{skill_id}{discriminator}"] = {
                    "rarity": rarity,
                    "alternatives": [alternative],
                }
        else:
            skill_data[str(skill_id)] = {
                "rarity": rarity,
                "alternatives": alternatives,
            }

    return skill_data


def analyze_permanent_skill_alternatives(skill_data: dict) -> dict:
    report = {
        "skillsWithPermanentAlternative": 0,
        "skillsWithOnlyPermanentAlternatives": 0,
        "skillsWithMixedPermanentAlternatives": [],
        "skillsWithMultiplePermanentAlternatives": [],
        "skillsWithAnyPermanentAndMultipleAlternatives": [],
    }

    for skill_id, entry in skill_data.items():
        alternatives = entry.get("alternatives", [])
        durations = [alternative.get("baseDuration") for alternative in alternatives]
        permanent_count = sum(1 for duration in durations if duration == -1)

        if permanent_count <= 0:
            continue

        report["skillsWithPermanentAlternative"] += 1

        if durations and all(duration == -1 for duration in durations):
            report["skillsWithOnlyPermanentAlternatives"] += 1

        if len(alternatives) > 1:
            report["skillsWithAnyPermanentAndMultipleAlternatives"].append(
                {
                    "skillId": skill_id,
                    "baseDurations": durations,
                }
            )

        if permanent_count > 1:
            report["skillsWithMultiplePermanentAlternatives"].append(
                {
                    "skillId": skill_id,
                    "baseDurations": durations,
                }
            )

        if permanent_count > 0 and any(duration != -1 for duration in durations):
            report["skillsWithMixedPermanentAlternatives"].append(
                {
                    "skillId": skill_id,
                    "baseDurations": durations,
                }
            )

    return report


def print_permanent_skill_alternative_report(report: dict) -> None:
    print(
        "[skill_data] permanent alternative summary: total=%d, only_permanent=%d, mixed=%d, multi_permanent=%d, multi_alternative_with_permanent=%d"
        % (
            report["skillsWithPermanentAlternative"],
            report["skillsWithOnlyPermanentAlternatives"],
            len(report["skillsWithMixedPermanentAlternatives"]),
            len(report["skillsWithMultiplePermanentAlternatives"]),
            len(report["skillsWithAnyPermanentAndMultipleAlternatives"]),
        )
    )

    if report["skillsWithMixedPermanentAlternatives"]:
        print(
            "[skill_data] WARNING: mixed permanent alternatives found: %s"
            % ", ".join(
                "%s %s"
                % (item["skillId"], item["baseDurations"])
                for item in report["skillsWithMixedPermanentAlternatives"]
            )
        )

    if report["skillsWithMultiplePermanentAlternatives"]:
        print(
            "[skill_data] INFO: multiple permanent alternatives found: %s"
            % ", ".join(
                "%s %s"
                % (item["skillId"], item["baseDurations"])
                for item in report["skillsWithMultiplePermanentAlternatives"]
            )
        )


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
    cursor.execute("""SELECT ri.id, ri.race_id, r.course_set, rcs.distance, rcs.ground, t.text
                      FROM race_instance AS ri
                      LEFT JOIN race AS r ON ri.race_id = r.id
                      LEFT JOIN race_course_set AS rcs ON r.course_set = rcs.id
                      LEFT JOIN text_data AS t ON t."index" = ri.id AND t.category = 29;""")
    rows = cursor.fetchall()
    for row in rows:
        r = data_pb2.RaceInstance()
        r.id = row[0]
        r.race_id = row[1]
        r.course_set = row[2]
        r.distance = row[3]
        r.ground_type = row[4]
        r.name = row[5] or "Unknown"
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


def build_succession_factor_meta(cursor: sqlite3.Cursor) -> dict:
    """Build the factor catalogue used by the succession planner.

    `succession_factor_effect.target_type = 41` grants a skill hint. Keeping
    its skill group lets a race factor and the corresponding skill factor act
    as alternative sources for the same requested skill. Only rarity-1 output
    skills are inheritable here: this keeps ordinary skills and the base
    unique skills granted by green factors, while excluding gold/evolved
    skills and higher unique variants.
    """
    cursor.execute(
        """SELECT sf.factor_id, sf.factor_group_id, sf.rarity, sf.factor_type,
                  factor_text.text
           FROM succession_factor AS sf
           JOIN text_data AS factor_text
             ON factor_text.category = 147
            AND factor_text."index" = sf.factor_id
           WHERE sf.factor_type IN (3, 4, 5)
           ORDER BY sf.factor_type, sf.factor_group_id, sf.rarity;"""
    )
    factors = {
        str(factor_id): {
            "id": factor_id,
            "groupId": factor_group_id,
            "stars": rarity,
            "factorType": factor_type,
            "name": name,
            "skillGroupIds": [],
            "skillTargets": [],
        }
        for factor_id, factor_group_id, rarity, factor_type, name in cursor.fetchall()
    }

    cursor.execute(
        """SELECT sf.factor_id, skill.group_id, skill.icon_id, skill.group_rate,
                  skill_text.text
           FROM succession_factor AS sf
           JOIN succession_factor_effect AS effect
             ON effect.factor_group_id = sf.factor_group_id
            AND effect.effect_id = sf.rarity
            AND effect.target_type = 41
           JOIN skill_data AS skill ON skill.id = effect.value_1
           JOIN text_data AS skill_text
             ON skill_text.category = 47
            AND skill_text."index" = skill.id
           WHERE sf.factor_type IN (3, 4, 5)
             AND skill.rarity = 1
           ORDER BY sf.factor_id, skill.group_id;"""
    )
    for (
        factor_id,
        skill_group_id,
        skill_icon_id,
        skill_level,
        skill_name,
    ) in cursor.fetchall():
        factor = factors.get(str(factor_id))
        if factor is None:
            continue
        if skill_group_id not in factor["skillGroupIds"]:
            factor["skillGroupIds"].append(skill_group_id)
        if not any(
            target["groupId"] == skill_group_id
            for target in factor["skillTargets"]
        ):
            factor["skillTargets"].append(
                {
                    "groupId": skill_group_id,
                    "name": skill_name,
                    "iconId": skill_icon_id,
                    "level": skill_level,
                }
            )

    return factors


def build_succession_skill_meta(factors: dict) -> dict:
    """Build a compact renderer fallback for skill names and icons."""
    skills = {}
    for factor in factors.values():
        for target in factor.get("skillTargets", []):
            key = str(target["groupId"])
            current = skills.get(key)
            target_level = target.get("level", 0)
            target_priority = target_level if target_level > 0 else 1
            current_level = current.get("level", 0) if current else 0
            current_priority = current_level if current_level > 0 else 1
            if current is None or target_priority < current_priority:
                skills[key] = {
                    "groupId": target["groupId"],
                    "name": target["name"],
                    "iconId": target["iconId"],
                    "level": target_level,
                }
    return skills


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--db_path", default="master.mdb")
    parser.add_argument("--version", default="test")
    parser.add_argument("--skill_data_out", default="assets/data/skill_data.json")
    parser.add_argument("--only_skill_data", action="store_true")
    parser.add_argument(
        "--succession_factor_meta_out",
        default="assets/data/succession_factor_meta.json",
    )
    parser.add_argument(
        "--succession_skill_meta_out",
        default="src/renderer/data/succession_skill_meta.json",
    )
    parser.add_argument("--only_succession_factor_meta", action="store_true")
    args = parser.parse_args()

    cursor = open_db(args.db_path)
    succession_factor_meta = build_succession_factor_meta(cursor)
    os.makedirs(os.path.dirname(args.succession_factor_meta_out) or ".", exist_ok=True)
    with open(args.succession_factor_meta_out, "w", encoding="utf-8") as f:
        json.dump(succession_factor_meta, f, ensure_ascii=False, indent=2)
    succession_skill_meta = build_succession_skill_meta(succession_factor_meta)
    os.makedirs(os.path.dirname(args.succession_skill_meta_out) or ".", exist_ok=True)
    with open(args.succession_skill_meta_out, "w", encoding="utf-8") as f:
        json.dump(succession_skill_meta, f, ensure_ascii=False, indent=2)

    if args.only_succession_factor_meta:
        return

    skill_data = build_skill_data(cursor)
    permanent_skill_report = analyze_permanent_skill_alternatives(skill_data)
    print_permanent_skill_alternative_report(permanent_skill_report)
    os.makedirs(os.path.dirname(args.skill_data_out) or ".", exist_ok=True)
    with open(args.skill_data_out, "w", encoding="utf-8") as f:
        json.dump(skill_data, f, ensure_ascii=False, indent=2)

    if args.only_skill_data:
        return

    global data_pb2, json_format
    from google.protobuf import json_format
    import proto.data_pb2 as data_pb2

    pb = data_pb2.UMDatabase()
    pb.version = args.version

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
    monte_carlo_data = build_monte_carlo_data(cursor, support_card_meta)
    chara_effect_texts = build_chara_effect_texts(cursor)
    skill_tip_names = build_skill_tip_names(cursor)
    card_talent_rates = build_card_talent_rates(cursor)
    card_rarity_data = build_card_rarity_data(cursor)
    arc_rival_dress_ids = build_arc_rival_dress_ids(cursor)
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
    umdb_json["cardRarityData"] = card_rarity_data
    umdb_json["arcRivalDressIds"] = arc_rival_dress_ids
    with open("assets/data/umdb.json", "w", encoding="utf-8") as f:
        json.dump(umdb_json, f, ensure_ascii=False, indent=2)
    for support_card_meta_path in (
        "assets/data/support_card_meta.json",
        "support_card_meta.generated.json",
    ):
        with open(support_card_meta_path, "w", encoding="utf-8") as f:
            json.dump(support_card_meta, f, ensure_ascii=False, indent=2)
    with open("assets/data/monte_carlo.json", "w", encoding="utf-8") as f:
        json.dump(monte_carlo_data, f, ensure_ascii=False, separators=(",", ":"))


if __name__ == "__main__":
    main()
