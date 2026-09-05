"""Generate UmaShow-owned AutoResearch skill and race configuration data."""

from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_MASTER = ROOT / "master.mdb"
DEFAULT_OUTPUT = ROOT / "assets" / "data" / "auto_research_catalog.json"

GRADE_LABELS = {
    100: "G1",
    200: "G2",
    300: "G3",
    400: "OP",
    700: "PRE-OP",
    1000: "EX",
}
TRACK_LABELS = {
    10001: "札幌",
    10002: "函馆",
    10003: "新潟",
    10004: "福岛",
    10005: "中山",
    10006: "东京",
    10007: "中京",
    10008: "京都",
    10009: "阪神",
    10010: "小仓",
    10101: "大井",
}
YEAR_LABELS = {0: "初级年", 24: "经典年", 48: "高级年"}
YEAR_OFFSETS = {1: (0,), 2: (24,), 3: (24, 48), 4: (48,)}


def distance_label(distance: int) -> str:
    if distance <= 1400:
        return "短距离"
    if distance <= 1800:
        return "英里"
    if distance <= 2400:
        return "中距离"
    return "长距离"


def race_occurrences(
    program_id: int,
    race_permission: int,
    month: int,
    half: int,
):
    if race_permission not in YEAR_OFFSETS:
        # Scenario-only races can occur outside the normal three-year calendar.
        # Keep them available for history lookup without placing them into the
        # editable race schedule.
        return ((program_id, 0, "剧本专属赛"),)
    return tuple(
        (
            {0: 1, 24: 2, 48: 3}[year_offset] * 100000 + program_id,
            year_offset + (month - 1) * 2 + half,
            (
                f"{YEAR_LABELS[year_offset]} {month}月"
                f"{'上半' if half == 1 else '下半'}"
            ),
        )
        for year_offset in YEAR_OFFSETS.get(race_permission, ())
    )


def generate_skills(connection: sqlite3.Connection) -> dict[str, dict]:
    rows = connection.execute(
        """
        SELECT
            skill.id,
            COALESCE(text.text, CAST(skill.id AS TEXT)),
            skill.rarity,
            skill.group_id,
            skill.grade_value,
            skill.disp_order,
            COALESCE(cost.need_skill_point, 0),
            skill.disable_singlemode,
            skill.tag_id,
            skill.icon_id,
            skill.skill_category
        FROM skill_data AS skill
        LEFT JOIN text_data AS text
          ON text.category = 47 AND text."index" = skill.id
        LEFT JOIN single_mode_skill_need_point AS cost
          ON cost.id = skill.id
        ORDER BY skill.id
        """
    )
    skills: dict[str, dict] = {}
    for row in rows:
        skill_id = int(row[0])
        skills[str(skill_id)] = {
            "name": str(row[1] or skill_id),
            "rarity": int(row[2] or 0),
            "group_id": int(row[3] or 0),
            "grade_value": int(row[4] or 0),
            "disp_order": int(row[5] or 0),
            "need_skill_point": int(row[6] or 0),
            "disable_singlemode": int(row[7] or 0),
            "tags": [
                int(value)
                for value in str(row[8] or "").split("/")
                if value.isdigit()
            ],
            "icon_id": int(row[9] or 0),
            "skill_category": int(row[10] or 0),
        }
    return skills


def generate_available_skills_by_card(
    connection: sqlite3.Connection,
) -> dict[str, list[dict]]:
    rows = connection.execute(
        """
        SELECT
            card.id,
            available.skill_id,
            available.need_rank
        FROM card_data AS card
        JOIN available_skill_set AS available
          ON available.available_skill_set_id = card.available_skill_set_id
        ORDER BY card.id, available.need_rank, available.id
        """
    )
    available_skills: dict[str, list[dict]] = {}
    for card_id, skill_id, need_rank in rows:
        available_skills.setdefault(str(int(card_id)), []).append(
            {
                "skill_id": int(skill_id or 0),
                "need_rank": int(need_rank or 0),
            }
        )
    return available_skills


def generate_races(connection: sqlite3.Connection) -> list[dict]:
    rows = connection.execute(
        """
        SELECT
            program.id,
            program.race_permission,
            program.month,
            program.half,
            instance.id,
            COALESCE(text.text, CAST(instance.id AS TEXT)),
            race.grade,
            race.thumbnail_id,
            course.race_track_id,
            course.ground,
            course.distance
        FROM single_mode_program AS program
        JOIN race_instance AS instance
          ON instance.id = program.race_instance_id
        JOIN race
          ON race.id = instance.race_id
        JOIN race_course_set AS course
          ON course.id = race.course_set
        LEFT JOIN text_data AS text
          ON text.category = 28 AND text."index" = instance.id
        WHERE COALESCE(program.base_program_id, 0) = 0
        ORDER BY program.id
        """
    )
    races: list[dict] = []
    for row in rows:
        program_id = int(row[0] or 0)
        race_permission = int(row[1] or 0)
        month = int(row[2] or 0)
        half = int(row[3] or 0)
        name = str(row[5] or row[4])
        grade = int(row[6] or 0)
        occurrences = race_occurrences(
            program_id,
            race_permission,
            month,
            half,
        )
        if not occurrences or grade not in GRADE_LABELS:
            continue
        if "Make Debut" in name or "Maiden Race" in name:
            continue
        for occurrence_id, turn, date in occurrences:
            races.append(
                {
                    "id": occurrence_id,
                    "program_id": program_id,
                    "turn": turn,
                    "name": name,
                    "date": date,
                    "type": GRADE_LABELS[grade],
                    "terrain": "泥地" if int(row[9] or 0) == 2 else "草地",
                    "distance": distance_label(int(row[10] or 0)),
                    "venue": TRACK_LABELS.get(int(row[8] or 0), ""),
                    "thumbnail_id": int(row[7] or 0),
                }
            )
    grade_order = {
        "G1": 1,
        "G2": 2,
        "G3": 3,
        "EX": 4,
        "OP": 5,
        "PRE-OP": 6,
    }
    races.sort(
        key=lambda race: (
            race["turn"],
            grade_order.get(race["type"], 99),
            race["name"],
            race["id"],
        )
    )
    return races


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--master", type=Path, default=DEFAULT_MASTER)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    if not args.master.is_file():
        raise FileNotFoundError(f"master.mdb not found: {args.master}")
    with sqlite3.connect(args.master) as connection:
        catalog = {
            "skills": generate_skills(connection),
            "available_skills_by_card": generate_available_skills_by_card(
                connection
            ),
            "races": generate_races(connection),
        }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        f"AutoResearch catalog ready: {len(catalog['skills'])} skills, "
        f"{len(catalog['races'])} races -> {args.output}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
