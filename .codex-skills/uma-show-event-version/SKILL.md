---
name: uma-show-event-version
description: Add or update UmaShow event rules in src/constant/events.ts and bump UmaShow app versions in package.json, package-lock.json, release/app/package.json, and release/app/package-lock.json. Use when the user asks to add an event, modify event options or success/failure mappings, or update the project version number.
---

# UmaShow Event And Version

Follow this workflow:

1. Read `src/constant/events.ts` and locate the nearest matching event block by story ID range or character/event group.
2. Add or update the target entry inside `EXACT_EVENT_RULES`.
3. Keep the event shape as:
   - `name: string`
   - `options: EventOptionGroup[]`
   - each selectable branch keyed by choice number
4. For simple binary outcomes, use:
   - `1: { desp: '成功', detail: '成功', type: 'correct' }`
   - `2: { desp: '失败', detail: '失败', type: 'wrong' }`
5. Preserve the file's existing structure and avoid broad rewrites, because this file may contain mojibake-like text in terminal output.

When updating the version number:

1. Keep these files in sync:
   - `package.json`
   - `package-lock.json`
   - `release/app/package.json`
   - `release/app/package-lock.json`
2. Prefer a patch bump unless the user specifies another target version.
3. In each lockfile, update both the top-level `version` and the root package entry under `packages[""]` when present.

Validation checklist:

1. Confirm the new story ID exists only once in `src/constant/events.ts`.
2. Confirm all four version files carry the same app version.
3. Avoid editing unrelated event rules.
