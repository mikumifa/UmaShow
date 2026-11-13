"""Build the planner's race rewards and mandatory goals from the CN master DB.

Keep this separate from the display-only race catalogue: goal races include
debut and scenario races that are intentionally absent from schedule pickers.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
YEAR_OFFSETS = {1: (0,), 2: (24,), 3: (24, 48), 4: (48,)}


def generate(master: Path) -> dict:
    with sqlite3.connect(f"file:{master}?mode=ro", uri=True) as db:
        db.row_factory = sqlite3.Row
        programs = {}
        for row in db.execute('''
            SELECT p.*, COALESCE(t.text, CAST(p.id AS TEXT)) name,
                   r.grade, r.thumbnail_id, c.ground, c.distance,
                   COALESCE(f.fan_count, 0) fans
            FROM single_mode_program p
            JOIN race_instance i ON i.id=p.race_instance_id
            JOIN race r ON r.id=i.race_id
            JOIN race_course_set c ON c.id=r.course_set
            LEFT JOIN text_data t ON t.category=28 AND t."index"=i.id
            LEFT JOIN single_mode_fan_count f ON f.fan_set_id=p.fan_set_id AND f."order"=1
            ORDER BY p.id
        '''):
            distance = row['distance']
            programs[row['id']] = {
                'programId': row['id'], 'name': row['name'], 'grade': row['grade'],
                'ground': 'dirt' if row['ground'] == 2 else 'turf',
                'distanceType': 'short' if distance <= 1400 else 'mile' if distance <= 1800 else 'middle' if distance <= 2400 else 'long',
                'distance': distance, 'fans': row['fans'],
                'requiredFans': row['need_fan_count'], 'thumbnailId': row['thumbnail_id'],
                'permission': row['race_permission'], 'month': row['month'], 'half': row['half'],
                'baseId': row['base_program_id'], 'programGroup': row['program_group'],
            }
        groups = {}
        for row in db.execute('SELECT * FROM single_mode_race_group ORDER BY id'):
            groups.setdefault(row['race_group_id'], []).append(row['race_program_id'])
        scenario_events = [
            {'scenarioId': 5, 'turn': row['turn_num'],
             'programIds': groups.get(row['race_group_id'], [])}
            for row in db.execute('SELECT * FROM single_mode_venus_sprace_data ORDER BY turn_num')
        ]
        routes = []
        for route in db.execute('SELECT * FROM single_mode_route WHERE scenario_id IN (0, 6) ORDER BY id'):
            goals = []
            # 99 marks a conditional replacement goal. Combining these with
            # the default route creates impossible simultaneous obligations.
            for row in db.execute('SELECT * FROM single_mode_route_race WHERE race_set_id=? AND target_type=1 AND determine_race_for_generate<>99 ORDER BY sort_id', (route['race_set_id'],)):
                ids = []
                if row['condition_type'] == 1:
                    condition = row['condition_id']
                    ids = [condition] if condition in programs else groups.get(condition, [])
                goals.append({
                    'id': row['id'], 'turn': row['turn'], 'programIds': ids,
                    'conditionType': row['condition_type'], 'conditionId': row['condition_id'],
                    'value': row['condition_value_1'], 'value2': row['condition_value_2'],
                })
            routes.append({'id': route['id'], 'charaId': route['chara_id'], 'scenarioId': route['scenario_id'], 'goals': goals})
        charas = []
        for row in db.execute('''SELECT c.chara_id, r.*, t.text name FROM card_data c
            JOIN card_rarity_data r ON r.card_id=c.id AND r.rarity=c.default_rarity
            JOIN text_data t ON t.category=6 AND t."index"=c.chara_id
            WHERE c.id=(SELECT MIN(other.id) FROM card_data other WHERE other.chara_id=c.chara_id)
            ORDER BY c.chara_id'''):
            keys = {'turf': 'ground_turf', 'dirt': 'ground_dirt', 'short': 'distance_short',
                    'mile': 'distance_mile', 'middle': 'distance_middle', 'long': 'distance_long',
                    'nige': 'running_style_nige', 'senko': 'running_style_senko',
                    'sashi': 'running_style_sashi', 'oikomi': 'running_style_oikomi'}
            charas.append({'id': row['chara_id'], 'name': row['name'], 'aptitudes': {
                key: row['proper_' + value] for key, value in keys.items()
            }})
    return {
        'schemaVersion': 1, 'masterSha256': hashlib.sha256(master.read_bytes()).hexdigest(),
        'programs': programs, 'characters': charas, 'routes': routes,
        'scenarioEvents': scenario_events,
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--master', type=Path, default=ROOT / 'master.mdb')
    parser.add_argument('--output', type=Path, default=ROOT / 'src/renderer/data/race_planner_data.json')
    args = parser.parse_args()
    data = generate(args.master.resolve())
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print(f"Wrote {len(data['programs'])} programs and {len(data['routes'])} goal routes to {args.output}")
