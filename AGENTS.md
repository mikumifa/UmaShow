# AGENTS Notes

## Race Packet Handling Rules

- `handleRaceInfo` must support three response shapes:
  - Legacy direct payload: `race_scenario + race_horse_data_array`
  - History-first payload: `race_history_info_array[].room_info + race_history_chara_result_array`
  - Room payload (can be complete in one packet): `room_info.race_scenario + race_horse_data_array`
- History-first packets often contain only simplified horse fields. Full `race_horse_data_array` can arrive later.
- Use a pending cache keyed by `room_id`; save only after merge is complete.
- During completion, match pending records by `race_num` first. If no match, fallback to latest pending in the same room.
- Horse merge keys:
  - Primary: `viewer_id + team_id + team_member_id`
  - Fallback: `team_id + team_member_id`
- `room_id` resolve priority:
  - `room_user_array[].room_id` (when unique)
  - `room_id`
  - `race_result_info.room_id` or `result_info.room_id`

## Race UI Notes

- Race table can include a final stamina column (`Final HP`).
- Final HP source: `_.last(raceData.frame)?.horseFrame?.[frameOrder]?.hp ?? 0`.

## Simplified History Horse Data Notes

- `race_history_chara_result_array` may only contain minimal fields like `viewer_id/card_id/final_grade/rank`.
- Do not assume `skill_array/speed/stamina/...` exists.
- `fromRaceHorseData` must tolerate missing fields.
- `rankScore` can fallback to `final_grade`.

## Encoding and File Editing Notes

- Prefer `apply_patch` when editing TS/TSX files with CJK text.
- Avoid rewrite commands that may change file encoding unexpectedly.
- If script-writing files is required, explicitly write UTF-8 without BOM.
