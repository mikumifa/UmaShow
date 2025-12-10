import argparse
import base64
import gzip
import json
import sqlite3
import os
from collections import defaultdict
from google.protobuf import json_format
import proto.data_pb2 as data_pb2

# 直接指向解包后的资源目录
SOURCE_ICON_DIR = r"D:\Apps\umas\export\Texture2D"

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

        # 直接从源目录读取，文件名格式通常为 chr_icon_training_{id}.png
        icon_filename = f"chr_icon_training_{c.id}.png"
        icon_path = os.path.join(SOURCE_ICON_DIR, icon_filename)

        if os.path.exists(icon_path):
            try:
                with open(icon_path, "rb") as img_file:
                    img_data = img_file.read()
                    base64_bytes = base64.b64encode(img_data)
                    base64_string = base64_bytes.decode('utf-8')
                    # 设置 Base64 Data URI
                    c.icon_url = f"data:image/png;base64,{base64_string}"
            except Exception as e:
                print(f"Error encoding image for chara {c.id}: {e}")
        else:
            # 调试用：如果找不到图片，可以打印一下（可选）
            # print(f"Icon not found for {c.id} at {icon_path}")
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
    cursor.execute("""SELECT s.id, t.text, s.chara_id
                      FROM support_card_data AS s
                      JOIN text_data AS t ON t."index"=s.id AND t.category=75;""")
    rows = cursor.fetchall()
    for row in rows:
        c = data_pb2.SupportCard()
        c.id = row[0]
        c.name = row[1]
        c.chara_id = row[2]
        pb.support_card.append(c)

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
    ):
        p(pb, cursor)

    print(f"Loaded {len(pb.chara)} characters.")
    if len(pb.chara) > 0:
        # 打印一个样本看看是否成功读取了 icon_url
        print(f"Sample Chara: {pb.chara[0].name}, Icon URL length: {len(pb.chara[0].icon_url)}")

    os.makedirs("assets/data", exist_ok=True)
    with open("assets/data/umdb.binarypb.gz", "wb") as f:
        f.write(gzip.compress(pb.SerializeToString(), mtime=0))
    with open("assets/data/umdb.json", "w", encoding="utf-8") as f:
        json.dump(json_format.MessageToDict(pb), f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    main()
