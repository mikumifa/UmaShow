"""Index GameTora's skill event sources for the local master and offline use.

Pass a downloaded GameTora skills JSON. The bundled snapshot comes from
https://gametora.com/data/umamusume/skills.7500a994.json
"""

import argparse
import json
import sqlite3
from collections import defaultdict
from pathlib import Path

from generate_auto_research_catalog import DEFAULT_MASTER, ROOT


def generate(connection, skills):
    tables = {
        "uma": "card_data",
        "support": "support_card_data",
        "scenario": "single_mode_scenario",
    }
    owners = {
        key: {row[0] for row in connection.execute(f"SELECT id FROM {table}")}
        for key, table in tables.items()
    }
    local_skills = {row[0] for row in connection.execute("SELECT id FROM skill_data")}
    index = {key: defaultdict(set) for key in tables}
    for skill in skills:
        if skill["id"] not in local_skills:
            continue
        sources = {
            "uma": skill.get("char_e", []),
            "support": [card for tier in skill.get("sup_e", []) for card in tier],
            "scenario": skill.get("sce_e", []),
        }
        for key, ids in sources.items():
            for owner in owners[key].intersection(ids):
                index[key][owner].add(skill["id"])
    return {
        key: {owner: sorted(ids) for owner, ids in sorted(entries.items())}
        for key, entries in index.items()
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("skills_json", type=Path)
    parser.add_argument("--master", type=Path, default=DEFAULT_MASTER)
    parser.add_argument(
        "--output", type=Path, default=ROOT / "assets/data/auto_research_event_skills.json"
    )
    args = parser.parse_args()
    skills = json.loads(args.skills_json.read_text(encoding="utf-8"))
    with sqlite3.connect(args.master.resolve().as_uri() + "?mode=ro", uri=True) as connection:
        result = generate(connection, skills)
    args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
