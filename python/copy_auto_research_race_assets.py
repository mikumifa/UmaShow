"""Copy selectable career race thumbnails into UmaShow's local assets."""

from __future__ import annotations

import argparse
import shutil
import sqlite3
from pathlib import Path


DEFAULT_SOURCE = Path(r"D:\Apps\umas\export\Texture2D")
DEFAULT_MASTER = Path(__file__).resolve().parent.parent / "master.mdb"
DEFAULT_OUTPUT = Path(__file__).resolve().parent.parent / "assets" / "race_thumb"

SELECT_THUMBNAILS = """
SELECT DISTINCT race.thumbnail_id
FROM single_mode_program AS program
JOIN race_instance AS instance ON instance.id = program.race_instance_id
JOIN race ON race.id = instance.race_id
WHERE COALESCE(program.base_program_id, 0) = 0
  AND program.race_permission IN (1, 2, 3, 4)
  AND race.grade IN (100, 200, 300, 400, 700)
  AND COALESCE(race.thumbnail_id, 0) <> 0
ORDER BY race.thumbnail_id
"""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--master", type=Path, default=DEFAULT_MASTER)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if not args.master.is_file():
        raise FileNotFoundError(f"master.mdb not found: {args.master}")
    if not args.source.is_dir():
        raise FileNotFoundError(f"Texture2D directory not found: {args.source}")

    with sqlite3.connect(args.master) as connection:
        thumbnail_ids = [
            int(row[0]) for row in connection.execute(SELECT_THUMBNAILS)
        ]

    args.output.mkdir(parents=True, exist_ok=True)
    copied = 0
    unchanged = 0
    missing: list[str] = []
    for thumbnail_id in thumbnail_ids:
        source = args.source / f"thum_race_rt_000_{thumbnail_id:04d}_00.png"
        destination = args.output / f"{thumbnail_id}.png"
        if not source.is_file():
            missing.append(source.name)
            continue
        if destination.is_file() and destination.stat().st_size == source.stat().st_size:
            unchanged += 1
            continue
        shutil.copy2(source, destination)
        copied += 1

    print(
        f"Race assets ready: {len(thumbnail_ids)} selected, "
        f"{copied} copied, {unchanged} unchanged, {len(missing)} missing."
    )
    if missing:
        print("Missing files:")
        for filename in missing:
            print(f"  {filename}")
    return 1 if missing else 0


if __name__ == "__main__":
    raise SystemExit(main())
