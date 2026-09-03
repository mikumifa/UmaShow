import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { app } from 'electron';
import {
  findActiveIdleSingleMode,
  hasActiveSingleModeCareer,
} from './AutoResearchGameState';
import type {
  Dashboard,
  FactorInfo,
  OfflineSingleModeScenario,
  SupportInfo,
} from '../../renderer/components/autoResearch/types';

type UnknownRecord = Record<string, unknown>;

type Parent = Dashboard['parents'][number];

type Friend = Dashboard['friends'][number];

type IdleSingleMode = NonNullable<Dashboard['account']['idle_single_mode']>;

type ActiveCareer = NonNullable<Dashboard['account']['career']>;

type MasterSupport = Omit<SupportInfo, 'owned' | 'exp' | 'limit_break_count'>;

type MasterCatalog = {
  cardNames: Map<number, string>;
  cardCharaIds: Map<number, number>;
  raceDressIds: Map<string, number>;
  supports: Map<number, MasterSupport>;
  factors: Map<number, FactorInfo>;
  offlineScenarios: OfflineSingleModeScenario[];
};

/**
 * The mapper intentionally takes a decoded `load/index` packet rather than a
 * game client.  It can therefore be used by every local operation without
 * creating another session or making another game request.
 */
export type LocalDashboardOptions = {
  /** Game-server unix time, preferably `data_headers.servertime`. */
  serverTime?: number;
  /** Test/development override. Production normally resolves master.mdb. */
  masterDatabasePath?: string;
  /** Reuse an already-open read-only database in focused callers/tests. */
  database?: Database.Database;
  /** Source label exposed with the offline-career marker. */
  source?: string;
  /** Testable observation timestamp. Defaults to the local current time. */
  observedAt?: string;
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

const IDLE_STATES: Record<number, IdleSingleMode['state']> = {
  1: 'playing',
  2: 'finished',
  3: 'log_checked',
};

const SUPPORT_RARITIES: Record<number, string> = {
  1: 'R',
  2: 'SR',
  3: 'SSR',
};

const SUPPORT_COMMAND_TYPES: Record<number, string> = {
  101: 'Speed',
  102: 'Power',
  103: 'Guts',
  105: 'Stamina',
  106: 'Wisdom',
};

const SUPPORT_CARD_TYPES: Record<number, string> = {
  2: 'Friends',
  3: 'Group',
};

function asRecord(value: unknown): UnknownRecord | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  return value as UnknownRecord;
}

function asRecords(value: unknown): UnknownRecord[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      const record = asRecord(item);
      return record ? [record] : [];
    });
  }
  const record = asRecord(value);
  return record ? [record] : [];
}

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function cleanText(value: unknown) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function positiveNumber(value: unknown) {
  const number = numberValue(value);
  return number > 0 ? number : 0;
}

function cardCharaId(cardId: number, master: MasterCatalog) {
  return (
    master.cardCharaIds.get(cardId) ||
    numberValue(String(Math.max(0, cardId)).slice(0, 4))
  );
}

function cardName(cardId: number, master: MasterCatalog) {
  return master.cardNames.get(cardId) || `未知角色 (${cardId})`;
}

function raceDressId(cardId: number, rarity: number, master: MasterCatalog) {
  return master.raceDressIds.get(`${cardId}:${rarity}`) || cardId;
}

function factorCategory(factorType: number, factorGroupId: number) {
  if (factorType === 1) return 'stat';
  if (factorType === 2 && factorGroupId >= 31 && factorGroupId <= 34) {
    return 'distance';
  }
  if (factorType === 3) return 'unique';
  return 'white';
}

function emptyMasterCatalog(): MasterCatalog {
  return {
    cardNames: new Map(),
    cardCharaIds: new Map(),
    raceDressIds: new Map(),
    supports: new Map(),
    factors: new Map(),
    offlineScenarios: [],
  };
}

function safeAll(
  database: Database.Database,
  statement: string,
  ...params: unknown[]
): UnknownRecord[] {
  try {
    return database.prepare<unknown[], UnknownRecord>(statement).all(...params);
  } catch {
    // Master data is versioned with the game. A missing optional table must
    // not make a local session appear logged out.
    return [];
  }
}

/** Resolves the packaged database while still supporting development builds. */
export function resolveLocalMasterDatabasePath(explicitPath?: string) {
  const candidates = explicitPath ? [explicitPath] : [];
  if (!explicitPath) {
    try {
      if (app.isPackaged) {
        candidates.push(path.join(process.resourcesPath, 'master.mdb'));
      } else {
        candidates.push(path.join(app.getAppPath(), 'master.mdb'));
      }
    } catch {
      // Electron's app object is not initialized in small unit tests.
    }
    candidates.push(path.resolve('master.mdb'));
  }
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function serverTimestamp(data: unknown, options: LocalDashboardOptions) {
  const requested = positiveNumber(options.serverTime);
  if (requested) return requested;
  const root = asRecord(data);
  const payload = root ? asRecord(root.data) || root : {};
  const headers =
    asRecord(root?.data_headers) || asRecord(payload.data_headers);
  return positiveNumber(headers?.servertime) || Math.floor(Date.now() / 1000);
}

function loadMasterCatalog(
  serverTime: number,
  options: LocalDashboardOptions,
): MasterCatalog {
  const suppliedDatabase = options.database;
  let database = suppliedDatabase;
  let closeDatabase = false;
  if (!database) {
    const databasePath = resolveLocalMasterDatabasePath(
      options.masterDatabasePath,
    );
    if (!databasePath) return emptyMasterCatalog();
    try {
      database = new Database(databasePath, {
        readonly: true,
        fileMustExist: true,
      });
      closeDatabase = true;
    } catch {
      return emptyMasterCatalog();
    }
  }

  const catalog = emptyMasterCatalog();
  try {
    safeAll(
      database,
      `
        SELECT card.id AS card_id, card.chara_id AS chara_id, text.text AS name
        FROM card_data AS card
        LEFT JOIN text_data AS text
          ON text.category = 14 AND text."index" = card.chara_id
      `,
    ).forEach((row) => {
      const cardId = positiveNumber(row.card_id);
      if (!cardId) return;
      const charaId = positiveNumber(row.chara_id);
      if (charaId) catalog.cardCharaIds.set(cardId, charaId);
      const name = cleanText(row.name);
      if (name) catalog.cardNames.set(cardId, name);
    });

    safeAll(
      database,
      'SELECT card_id, rarity, race_dress_id FROM card_rarity_data',
    ).forEach((row) => {
      const cardId = positiveNumber(row.card_id);
      const rarity = positiveNumber(row.rarity);
      const dressId = positiveNumber(row.race_dress_id);
      if (cardId && rarity && dressId) {
        catalog.raceDressIds.set(`${cardId}:${rarity}`, dressId);
      }
    });

    const supportLimits = new Map<number, number>();
    safeAll(
      database,
      'SELECT rarity, limit_4 AS max_level FROM support_card_limit',
    ).forEach((row) => {
      const rarity = positiveNumber(row.rarity);
      const level = positiveNumber(row.max_level);
      if (rarity && level) supportLimits.set(rarity, level);
    });

    const supportLevels = new Map<
      number,
      Array<{ level: number; exp: number }>
    >();
    safeAll(
      database,
      'SELECT rarity, level, total_exp FROM support_card_level',
    ).forEach((row) => {
      const rarity = positiveNumber(row.rarity);
      const level = positiveNumber(row.level);
      if (!rarity || !level) return;
      const rows = supportLevels.get(rarity) || [];
      rows.push({ level, exp: Math.max(0, numberValue(row.total_exp)) });
      supportLevels.set(rarity, rows);
    });

    safeAll(
      database,
      `
        SELECT support.id AS support_id, support.chara_id AS chara_id,
               support.rarity AS rarity, support.support_card_type AS support_type,
               support.command_id AS command_id, text.text AS name
        FROM support_card_data AS support
        LEFT JOIN text_data AS text
          ON text.category = 75 AND text."index" = support.id
      `,
    ).forEach((row) => {
      const supportId = positiveNumber(row.support_id);
      if (!supportId) return;
      const rarityNumber = positiveNumber(row.rarity);
      const levels = supportLevels.get(rarityNumber) || [];
      const maxLevel =
        supportLimits.get(rarityNumber) ||
        levels.reduce((maximum, level) => Math.max(maximum, level.level), 0);
      const maxExp =
        levels.find((level) => level.level === maxLevel)?.exp ||
        levels.reduce((maximum, level) => Math.max(maximum, level.exp), 0);
      const declaredType = SUPPORT_CARD_TYPES[positiveNumber(row.support_type)];
      const supportType =
        declaredType ||
        SUPPORT_COMMAND_TYPES[positiveNumber(row.command_id)] ||
        '?';
      catalog.supports.set(supportId, {
        id: supportId,
        chara_id: positiveNumber(row.chara_id),
        name: cleanText(row.name) || `未知支援卡 (${supportId})`,
        rarity: SUPPORT_RARITIES[rarityNumber] || '?',
        type: supportType,
        max_level: maxLevel,
        max_exp: maxExp,
      });
    });

    safeAll(
      database,
      `
        SELECT factor.factor_id AS factor_id,
               factor.factor_group_id AS factor_group_id,
               factor.rarity AS rarity,
               factor.factor_type AS factor_type,
               text.text AS name
        FROM succession_factor AS factor
        LEFT JOIN text_data AS text
          ON text.category = 147 AND text."index" = factor.factor_id
      `,
    ).forEach((row) => {
      const factorId = positiveNumber(row.factor_id);
      if (!factorId) return;
      const factorType = numberValue(row.factor_type);
      const factorGroupId = numberValue(row.factor_group_id);
      catalog.factors.set(factorId, {
        id: factorId,
        name: cleanText(row.name) || `未知因子 (${factorId})`,
        stars: positiveNumber(row.rarity) || factorId % 10 || 1,
        category: factorCategory(factorType, factorGroupId),
        factor_type: factorType,
        factor_group_id: factorGroupId,
      });
    });

    const scenarioNames = new Map<number, string>();
    safeAll(
      database,
      'SELECT "index" AS scenario_id, text FROM text_data WHERE category = 237',
    ).forEach((row) => {
      const scenarioId = positiveNumber(row.scenario_id);
      const name = cleanText(row.text);
      if (scenarioId && name) scenarioNames.set(scenarioId, name);
    });
    catalog.offlineScenarios = safeAll(
      database,
      `
        SELECT id, sort_id
        FROM single_mode_scenario
        WHERE start_date <= ? AND end_date >= ?
        ORDER BY sort_id DESC, id DESC
      `,
      serverTime,
      serverTime,
    ).flatMap((row) => {
      const id = positiveNumber(row.id);
      if (!id) return [];
      return [
        {
          id,
          name:
            scenarioNames.get(id) || IDLE_SCENARIO_NAMES[id] || `剧本 ${id}`,
          sort_id: numberValue(row.sort_id),
        },
      ];
    });
  } finally {
    if (closeDatabase) database.close();
  }
  return catalog;
}

function payloadData(value: unknown): UnknownRecord {
  const root = asRecord(value);
  if (!root) return {};
  return asRecord(root.data) || root;
}

function stateContainers(value: unknown) {
  const root = asRecord(value);
  if (!root) return [];
  const candidates = [root, root.data, root.user_info, root.load_data]
    .map(asRecord)
    .filter((candidate): candidate is UnknownRecord => Boolean(candidate));
  return [...new Set(candidates)];
}

function itemCounts(data: UnknownRecord) {
  const counts = new Map<number, number>();
  let rows = asRecords(data.item_list);
  if (!rows.length) rows = asRecords(data.user_item_array);
  if (!rows.length) rows = asRecords(data.user_item);
  rows.forEach((row) => {
    const itemId = positiveNumber(row.item_id);
    if (itemId) counts.set(itemId, Math.max(0, numberValue(row.number)));
  });
  return counts;
}

function nestedNumber(value: unknown, key: string) {
  const pending = stateContainers(value);
  const visited = new Set<UnknownRecord>();
  for (let index = 0; index < pending.length && index < 5_000; index += 1) {
    const current = pending[index];
    if (!visited.has(current)) {
      visited.add(current);
      if (current[key] != null) {
        const parsed = numberValue(current[key], -1);
        if (parsed >= 0) return parsed;
      }
      Object.values(current).forEach((child) => {
        const record = asRecord(child);
        if (record && !visited.has(record)) pending.push(record);
      });
    }
  }
  return undefined;
}

function idleInfo(value: unknown) {
  return stateContainers(value)
    .map((container) => asRecord(container.idle_single_mode_load_info))
    .find((info): info is UnknownRecord => Boolean(info));
}

function idleState(
  rawData: unknown,
  master: MasterCatalog,
  options: LocalDashboardOptions,
): IdleSingleMode {
  const activeIdle = findActiveIdleSingleMode(rawData);
  const info = activeIdle?.info || idleInfo(rawData);
  const source = options.source || 'load/index';
  const observedAt = options.observedAt || new Date().toISOString();
  if (!info) {
    return {
      detected: false,
      active: false,
      state: 'none',
      state_code: 0,
      source,
      observed_at: observedAt,
    };
  }
  const stateCode = numberValue(info.playing_state);
  const chara =
    asRecord(info.single_mode_chara_light) ||
    asRecord(info.chara_info) ||
    asRecord(info.single_mode_chara) ||
    {};
  const cardId = positiveNumber(chara.card_id);
  return {
    detected: true,
    active: Boolean(activeIdle),
    state: IDLE_STATES[stateCode] || 'unknown',
    state_code: stateCode,
    ...(cardId ? { card_id: cardId } : {}),
    name: cardId ? cardName(cardId, master) : '离线自动育成',
    scenario_id: positiveNumber(chara.scenario_id),
    current_turn: positiveNumber(
      chara.current_turn ?? chara.turn ?? info.current_turn,
    ),
    started_at: cleanText(info.start_time),
    ends_at: cleanText(info.end_time),
    source,
    observed_at: observedAt,
  };
}

function activeCareer(
  rawData: unknown,
  master: MasterCatalog,
): ActiveCareer | null {
  if (!hasActiveSingleModeCareer(rawData)) return null;
  const career = stateContainers(rawData)
    .flatMap((container) => [
      asRecord(container.single_mode_chara_light),
      asRecord(container.single_mode_chara),
    ])
    .find((candidate): candidate is UnknownRecord => Boolean(candidate));
  if (!career) return null;
  const cardId = positiveNumber(career.card_id);
  const supportCards =
    asRecords(career.support_card_array).length > 0
      ? asRecords(career.support_card_array)
      : asRecords(career.support_card_list);
  const friend = supportCards.find((card) => numberValue(card.position) === 6);
  return {
    active: true,
    ...(cardId ? { card_id: cardId } : {}),
    name: cardId ? cardName(cardId, master) : '进行中的育成',
    turn: numberValue(career.turn),
    scenario_id: numberValue(career.scenario_id),
    vital: numberValue(career.vital),
    max_vital: numberValue(career.max_vital),
    support_card_ids: supportCards.flatMap((card) => {
      const position = numberValue(card.position);
      const supportId = positiveNumber(card.support_card_id);
      return position >= 1 && position <= 5 && supportId ? [supportId] : [];
    }),
    friend_viewer_id: positiveNumber(friend?.owner_viewer_id),
    friend_card_id: positiveNumber(friend?.support_card_id),
    parent_id_1: positiveNumber(career.succession_trained_chara_id_1),
    parent_id_2: positiveNumber(career.succession_trained_chara_id_2),
  };
}

function accountStatus(
  data: UnknownRecord,
  rawData: unknown,
  master: MasterCatalog,
  options: LocalDashboardOptions,
): Dashboard['account'] {
  const items = itemCounts(data);
  const tp = asRecord(data.tp_info) || {};
  const coins = asRecord(data.coin_info) || {};
  const offline = idleState(rawData, master, options);
  const rentalMaximum = nestedNumber(
    rawData,
    'single_mode_trained_chara_rental_max_num',
  );
  const rentalUsed = nestedNumber(rawData, 'single_mode_rental_succession_num');
  const rentalKnown = rentalMaximum != null && rentalUsed != null;
  const career = offline.active ? null : activeCareer(rawData, master);
  const freeCarrots = Math.max(0, numberValue(coins.fcoin));
  const paidCarrots = Math.max(0, numberValue(coins.coin));
  return {
    tp: {
      current: Math.max(0, numberValue(tp.current_tp)),
      max: Math.max(0, numberValue(tp.max_tp)),
    },
    carrots: { total: freeCarrots + paidCarrots },
    gold: items.get(59) || 0,
    clocks: items.get(95) || 0,
    energy_drinks: items.get(32) || 0,
    rental_succession: {
      known: rentalKnown,
      used: Math.max(0, rentalUsed || 0),
      max: Math.max(0, rentalMaximum || 0),
      remaining: rentalKnown
        ? Math.max(0, (rentalMaximum || 0) - (rentalUsed || 0))
        : 0,
    },
    career,
    idle_single_mode: offline,
  };
}

function ownedSupports(data: UnknownRecord) {
  const owned = new Map<number, UnknownRecord>();
  asRecords(data.support_card_list).forEach((row) => {
    const supportId = positiveNumber(row.support_card_id ?? row.id);
    if (!supportId) return;
    const previous = owned.get(supportId);
    const quality = [numberValue(row.limit_break_count), numberValue(row.exp)];
    const previousQuality = [
      numberValue(previous?.limit_break_count),
      numberValue(previous?.exp),
    ];
    if (
      !previous ||
      quality[0] > previousQuality[0] ||
      (quality[0] === previousQuality[0] && quality[1] >= previousQuality[1])
    ) {
      owned.set(supportId, row);
    }
  });
  return owned;
}

function supportInfo(
  supportId: number,
  owned: Map<number, UnknownRecord>,
  master: MasterCatalog,
): SupportInfo {
  const metadata = master.supports.get(supportId);
  const ownedCard = owned.get(supportId);
  return {
    id: supportId,
    chara_id: metadata?.chara_id || 0,
    name: metadata?.name || `未知支援卡 (${supportId})`,
    rarity: metadata?.rarity || '?',
    type: metadata?.type || '?',
    max_level: metadata?.max_level || 0,
    max_exp: metadata?.max_exp || 0,
    owned: Boolean(ownedCard),
    exp: Math.max(0, numberValue(ownedCard?.exp)),
    limit_break_count: Math.max(0, numberValue(ownedCard?.limit_break_count)),
  };
}

function normalizeFactors(
  rows: unknown,
  factorExtends: unknown,
  positionId: number,
  master: MasterCatalog,
) {
  const replacements = new Map<number, number>();
  asRecords(factorExtends).forEach((row) => {
    if (numberValue(row.position_id) !== positionId) return;
    const base = positiveNumber(row.base_factor_id);
    const replacement = positiveNumber(row.factor_id);
    if (base && replacement) replacements.set(base, replacement);
  });
  return asRecords(rows).flatMap((row) => {
    const baseFactorId = positiveNumber(row.factor_id ?? row.id);
    const factorId = replacements.get(baseFactorId) || baseFactorId;
    if (!factorId) return [];
    const metadata = master.factors.get(factorId);
    return [
      metadata || {
        id: factorId,
        name: `未知因子 (${factorId})`,
        stars: factorId % 10 || 1,
        category: 'white',
        factor_type: 0,
        factor_group_id: 0,
      },
    ];
  });
}

function factorSummary(factors: FactorInfo[]) {
  return {
    stat: factors.find((factor) => factor.category === 'stat') || null,
    distance: factors.find((factor) => factor.category === 'distance') || null,
    unique:
      [...factors].reverse().find((factor) => factor.category === 'unique') ||
      null,
    white_count: factors.filter((factor) => factor.category === 'white').length,
  };
}

function ancestors(
  rows: unknown,
  factorExtends: unknown,
  master: MasterCatalog,
): Parent['ancestors'] {
  return asRecords(rows)
    .flatMap((row) => {
      const positionId = numberValue(row.position_id);
      if (positionId !== 10 && positionId !== 20) return [];
      const cardId = positiveNumber(row.card_id);
      const rarity = numberValue(row.rarity);
      const factors = normalizeFactors(
        row.factor_info_array,
        factorExtends,
        positionId,
        master,
      );
      return [
        {
          position_id: positionId,
          card_id: cardId,
          chara_id: cardCharaId(cardId, master),
          race_cloth_id:
            positiveNumber(row.race_cloth_id) ||
            raceDressId(cardId, rarity, master),
          rarity,
          name: cardName(cardId, master),
          factors,
          factor_summary: factorSummary(factors),
        },
      ];
    })
    .sort((left, right) => left.position_id - right.position_id);
}

function publicParent(
  row: UnknownRecord,
  source: Parent['source'],
  ownerName: string,
  master: MasterCatalog,
): Parent | undefined {
  const instanceId = positiveNumber(row.trained_chara_id);
  const cardId = positiveNumber(row.card_id);
  if (!instanceId || !cardId) return undefined;
  const viewerId = source === 'rental' ? positiveNumber(row.viewer_id) : 0;
  const rarity = numberValue(row.rarity);
  const factorExtends = row.factor_extend_array;
  const factors = normalizeFactors(
    row.factor_info_array,
    factorExtends,
    1,
    master,
  );
  return {
    selection_id: `${source}:${viewerId}:${instanceId}`,
    source,
    viewer_id: viewerId,
    owner_name: ownerName,
    instance_id: instanceId,
    card_id: cardId,
    chara_id: cardCharaId(cardId, master),
    name: cardName(cardId, master),
    rank: numberValue(row.rank),
    rank_score: numberValue(row.rank_score ?? row.final_grade),
    rarity,
    talent_level: numberValue(row.talent_level),
    race_cloth_id:
      positiveNumber(row.race_cloth_id) || raceDressId(cardId, rarity, master),
    scenario_id: numberValue(row.scenario_id),
    running_style: numberValue(row.running_style),
    stats: {
      speed: numberValue(row.speed),
      stamina: numberValue(row.stamina),
      power: numberValue(row.power ?? row.pow),
      guts: numberValue(row.guts),
      wiz: numberValue(row.wiz),
    },
    factors,
    factor_summary: factorSummary(factors),
    ancestors: ancestors(row.succession_chara_array, factorExtends, master),
  };
}

function normalizeFriends(
  data: UnknownRecord,
  owned: Map<number, UnknownRecord>,
  master: MasterCatalog,
) {
  const friendData = asRecord(data.friend_support_card_data) || {};
  const summaries =
    asRecords(friendData.summary_user_info_array).length > 0
      ? asRecords(friendData.summary_user_info_array)
      : asRecords(data.summary_user_info_array);
  const cards =
    asRecords(friendData.support_card_data_array).length > 0
      ? asRecords(friendData.support_card_data_array)
      : asRecords(data.support_card_data_array);
  const cardsByOwnerAndSupport = new Map<string, UnknownRecord>();
  cards.forEach((row) => {
    const viewerId = positiveNumber(row.viewer_id);
    const supportId = positiveNumber(row.support_card_id);
    if (viewerId && supportId) {
      cardsByOwnerAndSupport.set(`${viewerId}:${supportId}`, row);
    }
  });
  const excluded = new Set<number>();
  const seen = new Set<string>();
  const bestBySupport = new Map<number, Friend>();
  summaries.forEach((summary) => {
    const viewerId = positiveNumber(summary.viewer_id);
    const supportId = positiveNumber(summary.support_card_id);
    const key = `${viewerId}:${supportId}`;
    if (!viewerId || !supportId || seen.has(key)) return;
    seen.add(key);
    excluded.add(viewerId);
    const metadata = supportInfo(supportId, owned, master);
    const supportCard =
      cardsByOwnerAndSupport.get(key) ||
      asRecord(summary.user_support_card) ||
      {};
    const candidate: Friend = {
      viewer_id: viewerId,
      name: cleanText(summary.name),
      support_card_id: supportId,
      support_name: metadata.name,
      rarity: metadata.rarity,
      type: metadata.type,
      chara_id: metadata.chara_id,
      exp: Math.max(0, numberValue(supportCard.exp)),
      limit_break_count: Math.max(
        0,
        numberValue(supportCard.limit_break_count),
      ),
    };
    const current = bestBySupport.get(supportId);
    if (
      !current ||
      candidate.limit_break_count > current.limit_break_count ||
      (candidate.limit_break_count === current.limit_break_count &&
        candidate.exp > current.exp)
    ) {
      bestBySupport.set(supportId, candidate);
    }
  });
  return {
    friends: [...bestBySupport.values()],
    friendExcludeIds: [...excluded],
  };
}

function deckSupportIds(deck: UnknownRecord) {
  const rawIds = Array.isArray(deck.support_card_id_array)
    ? deck.support_card_id_array
    : asRecords(deck.support_card_id_array).map(
        (row) => row.support_card_id ?? row.id,
      );
  return rawIds.flatMap((id) => {
    const supportId = positiveNumber(id);
    return supportId ? [supportId] : [];
  });
}

/**
 * Build the renderer's dashboard directly from one local `load/index`
 * response and local master.mdb. It never makes a network request.
 */
export function buildLocalDashboard(
  rawData: unknown,
  options: LocalDashboardOptions = {},
): Dashboard {
  const data = payloadData(rawData);
  const master = loadMasterCatalog(serverTimestamp(rawData, options), options);
  const owned = ownedSupports(data);
  const friends = normalizeFriends(data, owned, master);

  const supportIds = new Set<number>([
    ...master.supports.keys(),
    ...owned.keys(),
    ...asRecords(data.support_card_deck_array).flatMap(deckSupportIds),
    ...friends.friends.map((friend) => friend.support_card_id),
  ]);
  const supports = [...supportIds]
    .filter((supportId) => supportId > 0)
    .sort((left, right) => left - right)
    .map((supportId) => supportInfo(supportId, owned, master));

  const decks = asRecords(data.support_card_deck_array).map((deck) => {
    const supportCardIds = deckSupportIds(deck);
    return {
      id: numberValue(deck.deck_id),
      name: cleanText(deck.name) || `卡组 ${numberValue(deck.deck_id)}`,
      support_card_ids: supportCardIds,
      cards: supportCardIds.map((supportId) =>
        supportInfo(supportId, owned, master),
      ),
    };
  });

  const umas = asRecords(data.card_list).flatMap((card) => {
    const cardId = positiveNumber(card.card_id ?? card.id);
    if (!cardId) return [];
    const rarity = numberValue(card.rarity);
    return [
      {
        id: cardId,
        chara_id: cardCharaId(cardId, master),
        name: cardName(cardId, master),
        rarity,
        talent_level: numberValue(card.talent_level),
        race_cloth_id: raceDressId(cardId, rarity, master),
      },
    ];
  });

  const parents: Parent[] = [];
  asRecords(data.trained_chara).forEach((row) => {
    const parent = publicParent(row, 'own', '', master);
    if (parent) parents.push(parent);
  });
  const rentalData = asRecord(data.succession_trained_chara_data) || {};
  const rentalNames = new Map<number, string>();
  asRecords(rentalData.summary_user_info_array).forEach((summary) => {
    const viewerId = positiveNumber(summary.viewer_id);
    if (viewerId) rentalNames.set(viewerId, cleanText(summary.name));
  });
  asRecords(rentalData.succession_trained_chara_array).forEach((row) => {
    const viewerId = positiveNumber(row.viewer_id);
    const parent = publicParent(
      row,
      'rental',
      rentalNames.get(viewerId) || '',
      master,
    );
    if (parent) parents.push(parent);
  });

  return {
    account: accountStatus(data, rawData, master, options),
    offline_scenarios: master.offlineScenarios,
    umas,
    supports,
    decks,
    parents,
    friends: friends.friends,
    friend_exclude_ids: friends.friendExcludeIds,
  };
}

/** A convenient local replacement for the server's account-options endpoint. */
export function buildLocalDashboardOptions(
  rawData: unknown,
  options: LocalDashboardOptions = {},
): Pick<
  Dashboard,
  | 'umas'
  | 'supports'
  | 'decks'
  | 'parents'
  | 'friends'
  | 'friend_exclude_ids'
  | 'offline_scenarios'
> {
  const dashboard = buildLocalDashboard(rawData, options);
  return {
    umas: dashboard.umas,
    supports: dashboard.supports,
    decks: dashboard.decks,
    parents: dashboard.parents,
    friends: dashboard.friends,
    friend_exclude_ids: dashboard.friend_exclude_ids,
    offline_scenarios: dashboard.offline_scenarios,
  };
}
