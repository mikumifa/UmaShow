import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { app, IpcMain } from 'electron';
import {
  findActiveIdleSingleMode,
  hasActiveSingleModeCareer,
} from './AutoResearchGameState';
import { withAutoResearchLocalGameClient } from './AutoResearchLocalGameClient';

type IdleRace = { year: number; program_id: number };

type IdleRaceDeck = {
  deck_num: number;
  deck_name: string;
  race_array: IdleRace[];
};

type IdlePrepareRequest = {
  card_id?: unknown;
  scenario_id?: unknown;
};

type IdleRaceDeckRequest = IdlePrepareRequest & {
  deck_num?: unknown;
  deck_name?: unknown;
  race_array?: unknown;
  is_default?: unknown;
};

const IDLE_SCENARIO_NAMES: Record<number, string> = {
  1: 'URA总决赛',
  2: '青春杯',
  3: '闪耀舞台',
  4: '巅峰杯',
  5: '荣耀女神杯',
  6: '凯旋门',
  7: 'U.A.F.',
};

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function booleanValue(value: unknown) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1';
  }
  return false;
}

function masterDatabasePath() {
  const candidates = app.isPackaged
    ? [path.join(process.resourcesPath, 'master.mdb')]
    : [path.join(app.getAppPath(), 'master.mdb'), path.resolve('master.mdb')];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error('UmaShow 本地 master.mdb 不存在');
  return found;
}

function normalizeRaceArray(value: unknown): IdleRace[] {
  const seen = new Set<string>();
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    const year = numberValue(raw?.year);
    const programId = numberValue(raw?.program_id);
    const key = `${year}:${programId}`;
    if (year < 1 || year > 3 || programId <= 0 || seen.has(key)) return [];
    seen.add(key);
    return [{ year, program_id: programId }];
  });
}

function serverTime(result: Record<string, any>) {
  const value = numberValue(result.data_headers?.servertime);
  return value > 0 ? value : Math.floor(Date.now() / 1000);
}

function scenarioOptions(database: Database.Database, timestamp: number) {
  const rows = database
    .prepare(
      `
        SELECT id, sort_id
        FROM single_mode_scenario
        WHERE start_date <= ? AND end_date >= ?
        ORDER BY sort_id DESC, id DESC
      `,
    )
    .all(timestamp, timestamp) as Array<{ id: unknown; sort_id: unknown }>;
  const names = new Map<number, string>();
  try {
    const nameRows = database
      .prepare('SELECT "index", text FROM text_data WHERE category = 237')
      .all() as Array<{ index: unknown; text: unknown }>;
    nameRows.forEach((row) => {
      const id = numberValue(row.index);
      const name = String(row.text || '')
        .replace(/\s+/g, ' ')
        .trim();
      if (id && name) names.set(id, name);
    });
  } catch {
    // Older master databases do not always have scenario display text.
  }
  return rows.map((row) => {
    const id = numberValue(row.id);
    return {
      id,
      name: names.get(id) || IDLE_SCENARIO_NAMES[id] || `剧本 ${id}`,
      sort_id: numberValue(row.sort_id),
    };
  });
}

function idleMasterContext(
  cardId: number,
  timestamp: number,
  requestedScenarioId: number,
) {
  const database = new Database(masterDatabasePath(), {
    readonly: true,
    fileMustExist: true,
  });
  try {
    const scenario = requestedScenarioId
      ? (database
          .prepare(
            `
              SELECT id, sort_id, chara_program_change_flag
              FROM single_mode_scenario
              WHERE id = ? AND start_date <= ? AND end_date >= ?
              LIMIT 1
            `,
          )
          .get(requestedScenarioId, timestamp, timestamp) as
          | { id: unknown }
          | undefined)
      : (database
          .prepare(
            `
              SELECT id, sort_id, chara_program_change_flag
              FROM single_mode_scenario
              WHERE start_date <= ? AND end_date >= ?
              ORDER BY sort_id DESC, id DESC
              LIMIT 1
            `,
          )
          .get(timestamp, timestamp) as { id: unknown } | undefined);
    if (!scenario) {
      if (requestedScenarioId) {
        throw new Error(
          `所选离线育成剧本当前不可用（scenario_id=${requestedScenarioId}）`,
        );
      }
      throw new Error('当前没有可用的离线育成剧本');
    }

    const scenarioId = numberValue(scenario.id);
    const charaId = numberValue(String(Math.max(0, cardId)).slice(0, 4));
    const card = database
      .prepare('SELECT running_style FROM card_data WHERE id = ?')
      .get(cardId) as { running_style: unknown } | undefined;
    const challenge = database
      .prepare(
        `
          SELECT id, start_date, end_date
          FROM training_challenge_master
          WHERE target_main_scenario = ?
            AND start_date <= ? AND end_date >= ?
          ORDER BY id DESC LIMIT 1
        `,
      )
      .get(scenarioId, timestamp, timestamp) as
      | { id: unknown; start_date: unknown; end_date: unknown }
      | undefined;

    let route = database
      .prepare(
        `
          SELECT id, race_set_id
          FROM single_mode_route
          WHERE scenario_id = ? AND chara_id IN (?, 0)
          ORDER BY CASE WHEN chara_id = ? THEN 0 ELSE 1 END,
                   priority DESC, id DESC
          LIMIT 1
        `,
      )
      .get(scenarioId, charaId, charaId) as
      | { id: unknown; race_set_id: unknown }
      | undefined;
    if (!route) {
      route = database
        .prepare(
          `
            SELECT id, race_set_id
            FROM single_mode_route
            WHERE scenario_id = 0 AND chara_id = ?
            ORDER BY priority DESC, id DESC LIMIT 1
          `,
        )
        .get(charaId) as { id: unknown; race_set_id: unknown } | undefined;
    }

    const required: IdleRace[] = [];
    const addRequired = (race: IdleRace) => {
      if (
        !required.some(
          (item) =>
            item.year === race.year && item.program_id === race.program_id,
        )
      ) {
        required.push(race);
      }
    };
    const addRouteRace = (routeRace: Record<string, unknown> | undefined) => {
      if (!routeRace) return;
      const conditionType = numberValue(routeRace.condition_type);
      if (conditionType === 8) {
        const changed = database
          .prepare(
            `
              SELECT route_race.*
              FROM single_mode_change_chara_route AS changed
              JOIN single_mode_route_race AS route_race
                ON route_race.id = changed.route_race_id
              WHERE changed.route_race_group_id = ?
                AND changed.chara_id = ?
              LIMIT 1
            `,
          )
          .get(numberValue(routeRace.condition_value_1), charaId) as
          | Record<string, unknown>
          | undefined;
        addRouteRace(changed);
        return;
      }
      if (conditionType !== 1) return;
      const conditionId = numberValue(routeRace.condition_id);
      const programs = database
        .prepare(
          `
            SELECT id FROM single_mode_program WHERE id = ?
            UNION ALL
            SELECT race_program_id AS id
            FROM single_mode_race_group WHERE race_group_id = ?
          `,
        )
        .all(conditionId, conditionId) as Array<{ id: unknown }>;
      const year = Math.max(
        1,
        Math.min(3, Math.floor((numberValue(routeRace.turn, 1) - 1) / 24) + 1),
      );
      programs.forEach((program) => {
        const programId = numberValue(program.id);
        if (programId > 0) addRequired({ year, program_id: programId });
      });
    };

    if (route) {
      const groupIds = new Set(
        (
          database
            .prepare(
              'SELECT group_id FROM single_mode_scenario_group WHERE scenario_id = ?',
            )
            .all(scenarioId) as Array<{ group_id: unknown }>
        ).map((row) => numberValue(row.group_id)),
      );
      const routeRaces = database
        .prepare(
          `
            SELECT * FROM single_mode_route_race
            WHERE race_set_id = ? AND target_type = 1
            ORDER BY sort_id
          `,
        )
        .all(numberValue(route.race_set_id)) as Array<Record<string, unknown>>;
      routeRaces.forEach((routeRace) => {
        const scenarioGroupId = numberValue(routeRace.scenario_group_id);
        if (scenarioGroupId && !groupIds.has(scenarioGroupId)) return;
        addRouteRace(routeRace);
      });
    }

    return {
      scenario_id: scenarioId,
      scenario_name: IDLE_SCENARIO_NAMES[scenarioId] || `剧本 ${scenarioId}`,
      scenarios: scenarioOptions(database, timestamp),
      running_style: numberValue(card?.running_style, 1),
      required_race_array: required,
      training_challenge: {
        available: Boolean(challenge),
        id: numberValue(challenge?.id),
        start_time: numberValue(challenge?.start_date),
        end_time: numberValue(challenge?.end_date),
      },
    };
  } finally {
    database.close();
  }
}

function idleSetupResponse(
  result: Record<string, any>,
  context: ReturnType<typeof idleMasterContext>,
) {
  const reserved = result.data?.reserved_race_info || {};
  const decks: IdleRaceDeck[] = (
    Array.isArray(reserved.reserved_race_array)
      ? reserved.reserved_race_array
      : []
  ).flatMap((raw: unknown) => {
    if (!raw || typeof raw !== 'object') return [];
    const record = raw as Record<string, unknown>;
    const deckNum = numberValue(record.deck_num);
    if (deckNum < 1 || deckNum > 8) return [];
    return [
      {
        deck_num: deckNum,
        deck_name: String(record.deck_name || ''),
        race_array: normalizeRaceArray(record.race_array),
      },
    ];
  });
  const known = new Set(decks.map((deck: IdleRaceDeck) => deck.deck_num));
  for (let deckNum = 1; deckNum <= 8; deckNum += 1) {
    if (!known.has(deckNum)) {
      decks.push({ deck_num: deckNum, deck_name: '', race_array: [] });
    }
  }
  decks.sort(
    (left: IdleRaceDeck, right: IdleRaceDeck) => left.deck_num - right.deck_num,
  );
  return {
    scenario_id: context.scenario_id,
    scenario_name: context.scenario_name,
    scenarios: context.scenarios,
    training_challenge: context.training_challenge,
    required_race_array: context.required_race_array,
    default_deck_num: numberValue(reserved.default_deck_num),
    needs_default_confirm: booleanValue(reserved.needs_default_confirm),
    race_decks: decks,
  };
}

export function ensureNoActiveCareer(data: Record<string, unknown>) {
  const idle = findActiveIdleSingleMode(data);
  if (idle) {
    const stateLabel =
      {
        1: '进行中',
        2: '已完成，等待查看结果',
        3: '结果已查看，等待游戏清理',
      }[idle.playingState] || '状态未知';
    throw new Error(
      `当前已有离线自动育成（${stateLabel}），请先在游戏内处理后再准备新的任务`,
    );
  }
  if (hasActiveSingleModeCareer(data)) {
    throw new Error('已有进行中的普通育成，不能准备离线自动育成');
  }
}

async function prepare(accountId: string, request: IdlePrepareRequest) {
  return withAutoResearchLocalGameClient(accountId, async (client) => {
    const index = await client.loadIndex();
    ensureNoActiveCareer(index.data || {});
    const options = await client.call('pre_single_mode/index');
    const context = idleMasterContext(
      numberValue(request.card_id),
      serverTime(options),
      numberValue(request.scenario_id),
    );
    const result = await client.prepareIdleSingleMode(context.scenario_id);
    return {
      success: true,
      offline_setup: idleSetupResponse(result, context),
    };
  });
}

async function saveRaceDeck(accountId: string, request: IdleRaceDeckRequest) {
  const deckNum = numberValue(request.deck_num);
  if (deckNum < 1 || deckNum > 8) {
    throw new Error('离线赛程槽位必须在 1 到 8 之间');
  }
  const scenarioId = numberValue(request.scenario_id);
  if (!scenarioId) throw new Error('请选择有效的离线育成剧本');
  return withAutoResearchLocalGameClient(accountId, async (client) => {
    const index = await client.loadIndex();
    ensureNoActiveCareer(index.data || {});
    const currentResult = await client.prepareIdleSingleMode(scenarioId);
    const reserved = currentResult.data?.reserved_race_info || {};
    const currentDeck = (
      Array.isArray(reserved.reserved_race_array)
        ? reserved.reserved_race_array
        : []
    ).find(
      (item: Record<string, unknown>) =>
        numberValue(item?.deck_num) === deckNum,
    );
    const current = normalizeRaceArray(currentDeck?.race_array);
    const desired = normalizeRaceArray(request.race_array);
    const currentKeys = new Set(
      current.map((item) => `${item.year}:${item.program_id}`),
    );
    const desiredKeys = new Set(
      desired.map((item) => `${item.year}:${item.program_id}`),
    );
    const result = await client.saveIdleSingleModeRaceDeck(
      scenarioId,
      deckNum,
      String(request.deck_name || '').slice(0, 20),
      desired.filter(
        (item) => !currentKeys.has(`${item.year}:${item.program_id}`),
      ),
      current.filter(
        (item) => !desiredKeys.has(`${item.year}:${item.program_id}`),
      ),
      booleanValue(request.is_default),
    );
    const context = idleMasterContext(
      numberValue(request.card_id),
      serverTime(result),
      scenarioId,
    );
    return {
      success: true,
      offline_setup: idleSetupResponse(result, context),
    };
  });
}

export default function handleAutoResearchIdleSingleMode(ipcMain: IpcMain) {
  ipcMain.handle(
    'autoresearch:idle-single-mode-prepare',
    (_, accountId: string, request: IdlePrepareRequest) =>
      prepare(accountId, request || {}),
  );
  ipcMain.handle(
    'autoresearch:idle-single-mode-race-deck',
    (_, accountId: string, request: IdleRaceDeckRequest) =>
      saveRaceDeck(accountId, request || {}),
  );
}
