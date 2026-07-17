import { BrowserWindow, IpcMain, shell } from 'electron';
import fs from 'fs';
import path from 'path';
import log from 'electron-log';
import {
  TrainingHistoryAnalysis,
  TrainingHistoryConfig,
  TrainingHistorySkill,
  TrainingHistorySkillTip,
  TrainingHistoryPacket,
  TrainingHistoryRecord,
  TrainingHistorySummary,
  TrainingHistoryTurnDelta,
  TrainingHistoryTurnSnapshot,
  TrainingHistoryTurn,
} from 'types/gameTypes';
import { isUMASingleModelResponse } from 'types/ingame/UMASingleModelResponse';
import { jsonReplacer } from 'main/util';
import { TRAINING_HISTORY_DIR } from 'main/paths';
import { buildTrainingEstimate } from './trainingHistory/trainingEstimate';

const CONFIG_FILE = 'training_history.config.json';
const ANALYSIS_VERSION = 7;
const DEFAULT_MAX_CACHED_RUNS = 50;
const RECORD_FILE_PREFIX = 'training_history_';
const RECORD_FILE_SUFFIX = '.json';
const RECORD_META_FILE_SUFFIX = '.meta.json';
const RECORD_PACKET_LOG_SUFFIX = '.jsonl';

const liveRecordCache = new Map<string, TrainingHistoryRecord>();

function ensureTrainingHistoryDir() {
  if (!fs.existsSync(TRAINING_HISTORY_DIR)) {
    fs.mkdirSync(TRAINING_HISTORY_DIR, { recursive: true });
  }
}

function configPath() {
  return path.join(TRAINING_HISTORY_DIR, CONFIG_FILE);
}

function sanitizeRecordId(id: string) {
  return id.replace(/[^\w-]+/g, '_');
}

function recordBaseName(id: string) {
  return `${RECORD_FILE_PREFIX}${sanitizeRecordId(id)}`;
}

function recordPath(id: string) {
  return path.join(TRAINING_HISTORY_DIR, `${recordBaseName(id)}${RECORD_FILE_SUFFIX}`);
}

function recordMetaPath(id: string) {
  return path.join(
    TRAINING_HISTORY_DIR,
    `${recordBaseName(id)}${RECORD_META_FILE_SUFFIX}`,
  );
}

function recordPacketLogPath(id: string) {
  return path.join(
    TRAINING_HISTORY_DIR,
    `${recordBaseName(id)}${RECORD_PACKET_LOG_SUFFIX}`,
  );
}

function readConfig(): TrainingHistoryConfig {
  ensureTrainingHistoryDir();
  if (!fs.existsSync(configPath())) {
    return { maxCachedRuns: DEFAULT_MAX_CACHED_RUNS, favoriteIds: [] };
  }

  try {
    const parsed = JSON.parse(
      fs.readFileSync(configPath(), 'utf-8'),
    ) as Partial<TrainingHistoryConfig>;
    const maxCachedRuns = Number(parsed.maxCachedRuns);
    const favoriteIds = Array.isArray(parsed.favoriteIds)
      ? parsed.favoriteIds
          .map((id) => String(id ?? '').trim())
          .filter((id, index, array) => id.length > 0 && array.indexOf(id) === index)
      : [];
    return {
      maxCachedRuns:
        Number.isFinite(maxCachedRuns) && maxCachedRuns > 0
          ? Math.floor(maxCachedRuns)
          : DEFAULT_MAX_CACHED_RUNS,
      favoriteIds,
    };
  } catch (error) {
    log.error('[TrainingHistory] Failed to read config:', error);
    return { maxCachedRuns: DEFAULT_MAX_CACHED_RUNS, favoriteIds: [] };
  }
}

function writeConfig(config: TrainingHistoryConfig) {
  ensureTrainingHistoryDir();
  const normalizedConfig: TrainingHistoryConfig = {
    maxCachedRuns: Math.max(
      1,
      Math.floor(Number(config.maxCachedRuns) || DEFAULT_MAX_CACHED_RUNS),
    ),
    favoriteIds: Array.isArray(config.favoriteIds)
      ? config.favoriteIds
          .map((id) => String(id ?? '').trim())
          .filter((id, index, array) => id.length > 0 && array.indexOf(id) === index)
      : [],
  };
  fs.writeFileSync(
    configPath(),
    JSON.stringify(normalizedConfig, jsonReplacer, 2),
    'utf-8',
  );
}

function getFavoriteIdSet(config = readConfig()) {
  return new Set(config.favoriteIds);
}

function applyFavorite(
  record: TrainingHistoryRecord | null,
  favoriteIds = getFavoriteIdSet(),
) {
  if (!record) return null;
  record.favorite = favoriteIds.has(record.id);
  return record;
}

function legacyRecordFiles() {
  ensureTrainingHistoryDir();
  const files = fs.readdirSync(TRAINING_HISTORY_DIR);
  const metaBaseNames = new Set(
    files
      .filter(
        (file) =>
          file.startsWith(RECORD_FILE_PREFIX)
          && file.endsWith(RECORD_META_FILE_SUFFIX),
      )
      .map((file) => path.basename(file, RECORD_META_FILE_SUFFIX)),
  );

  return files
    .filter(
      (file) =>
        file.startsWith(RECORD_FILE_PREFIX)
        && file.endsWith(RECORD_FILE_SUFFIX)
        && !file.endsWith(RECORD_META_FILE_SUFFIX)
        && !metaBaseNames.has(path.basename(file, RECORD_FILE_SUFFIX)),
    )
    .map((file) => path.join(TRAINING_HISTORY_DIR, file));
}

function recordFiles() {
  ensureTrainingHistoryDir();
  const files = fs.readdirSync(TRAINING_HISTORY_DIR);
  const metaFiles = files
    .filter(
      (file) =>
        file.startsWith(RECORD_FILE_PREFIX)
        && file.endsWith(RECORD_META_FILE_SUFFIX),
    )
    .map((file) => path.join(TRAINING_HISTORY_DIR, file));

  return [...metaFiles, ...legacyRecordFiles()];
}

function readRecord(file: string): TrainingHistoryRecord | null {
  try {
    const record = JSON.parse(
      fs.readFileSync(file, 'utf-8'),
    ) as TrainingHistoryRecord;
    record.fullPath = recordPath(record.id);
    if (
      record.analysis?.version !== ANALYSIS_VERSION
      && Array.isArray(record.packets)
    ) {
      record.analysis = buildAnalysis(record);
      record.summary = {
        ...record.analysis.summary,
        updatedAt: record.updatedAt,
      };
      fs.writeFileSync(file, JSON.stringify(record, jsonReplacer, 2), 'utf-8');
    }
    return applyFavorite(record);
  } catch (error) {
    log.error('[TrainingHistory] Failed to parse record:', file, error);
    return null;
  }
}

function toClientRecord(record: TrainingHistoryRecord): TrainingHistoryRecord {
  return {
    ...record,
    packets: [],
  };
}

function readRecordSummary(file: string): TrainingHistoryRecord | null {
  if (file.endsWith(RECORD_META_FILE_SUFFIX)) {
    try {
      const record = JSON.parse(
        fs.readFileSync(file, 'utf-8'),
      ) as TrainingHistoryRecord;
      record.fullPath = recordPath(record.id);
      record.packets = [];
      return applyFavorite(record);
    } catch (error) {
      log.error('[TrainingHistory] Failed to parse record summary:', file, error);
      return null;
    }
  }

  const record = readRecord(file);
  if (!record) return null;
  migrateLegacyRecord(record);
  return toClientRecord(record);
}

function readSummaryRecordById(id: string) {
  const metaFile = recordMetaPath(id);
  if (fs.existsSync(metaFile)) {
    return readRecordSummary(metaFile);
  }

  const fullFile = recordPath(id);
  if (!fs.existsSync(fullFile)) return null;
  const record = readRecord(fullFile);
  if (!record) return null;
  migrateLegacyRecord(record);
  return toClientRecord(record);
}

function readPacketsFromJsonl(file: string): TrainingHistoryPacket[] {
  if (!fs.existsSync(file)) return [];
  try {
    return fs
      .readFileSync(file, 'utf-8')
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as TrainingHistoryPacket);
  } catch (error) {
    log.error('[TrainingHistory] Failed to parse packet log:', file, error);
    return [];
  }
}

function writePacketsToJsonl(file: string, packets: TrainingHistoryPacket[]) {
  const content = packets
    .map((packet) => JSON.stringify(packet, jsonReplacer))
    .join('\n');
  fs.writeFileSync(file, content.length > 0 ? `${content}\n` : '', 'utf-8');
}

function appendPacketToJsonl(file: string, packet: TrainingHistoryPacket) {
  fs.appendFileSync(file, `${JSON.stringify(packet, jsonReplacer)}\n`, 'utf-8');
}

function writeRecord(record: TrainingHistoryRecord) {
  fs.writeFileSync(
    record.fullPath,
    JSON.stringify(record, jsonReplacer, 2),
    'utf-8',
  );
}

function writeRecordSummary(record: TrainingHistoryRecord) {
  const summaryRecord: TrainingHistoryRecord = {
    ...record,
    fullPath: recordPath(record.id),
    packets: [],
  };
  fs.writeFileSync(
    recordMetaPath(record.id),
    JSON.stringify(summaryRecord, jsonReplacer, 2),
    'utf-8',
  );
}

function deleteMaterializedRecord(id: string) {
  const file = recordPath(id);
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
  }
}

function isMaterializedRecordFresh(id: string) {
  const fullFile = recordPath(id);
  if (!fs.existsSync(fullFile)) return false;

  const fullStat = fs.statSync(fullFile);
  const metaFile = recordMetaPath(id);
  const packetFile = recordPacketLogPath(id);

  const metaFresh = !fs.existsSync(metaFile)
    || fullStat.mtimeMs >= fs.statSync(metaFile).mtimeMs;
  const packetFresh = !fs.existsSync(packetFile)
    || fullStat.mtimeMs >= fs.statSync(packetFile).mtimeMs;
  return metaFresh && packetFresh;
}

function materializeRecord(id: string): TrainingHistoryRecord | null {
  const cached = liveRecordCache.get(id);
  if (cached) return applyFavorite(cached);

  if (isMaterializedRecordFresh(id)) {
    const freshRecord = readRecord(recordPath(id));
    if (freshRecord) {
      liveRecordCache.set(id, freshRecord);
    }
    return applyFavorite(freshRecord);
  }

  const summaryRecord = readSummaryRecordById(id);
  if (!summaryRecord) return null;

  const packets = readPacketsFromJsonl(recordPacketLogPath(id));
  if (packets.length === 0) {
    const fallback = readRecord(recordPath(id));
    if (fallback) {
      migrateLegacyRecord(fallback);
      liveRecordCache.set(id, fallback);
      return applyFavorite(fallback);
    }
    return null;
  }

  const record: TrainingHistoryRecord = {
    ...summaryRecord,
    fullPath: recordPath(id),
    packets,
  };
  record.analysis = buildAnalysis(record);
  record.summary = {
    ...record.analysis.summary,
    updatedAt: record.updatedAt,
  };
  writeRecord(record);
  writeRecordSummary(record);
  liveRecordCache.set(id, record);
  return applyFavorite(record);
}

function migrateLegacyRecord(record: TrainingHistoryRecord) {
  const metaFile = recordMetaPath(record.id);
  const packetFile = recordPacketLogPath(record.id);
  if (!fs.existsSync(metaFile)) {
    writeRecordSummary(record);
  }
  if (!fs.existsSync(packetFile)) {
    writePacketsToJsonl(packetFile, record.packets);
  }
}

function migrateAllLegacyRecords() {
  legacyRecordFiles().forEach((file) => {
    const record = readRecord(file);
    if (!record) return;
    migrateLegacyRecord(record);
  });
}

function normalizeSingleModeData(data: Record<string, any>) {
  const common = data.single_mode_load_common;
  if (!common || typeof common !== 'object') {
    return data;
  }

  const normalized = { ...common } as Record<string, any>;
  Object.keys(data)
    .filter(
      (key) => key.endsWith('_data_set') || key.endsWith('_data_set_load'),
    )
    .forEach((key) => {
      if (normalized[key] == null) {
        normalized[key] = data[key];
      }
    });

  return normalized;
}

function getPacketData(packet: TrainingHistoryPacket) {
  const payload = packet.payload as any;
  if (!isUMASingleModelResponse(payload)) return null;
  return normalizeSingleModeData(payload.data as Record<string, any>);
}

function hasCommandResult(commandResult: any) {
  if (!commandResult || typeof commandResult !== 'object') return false;
  return Object.keys(commandResult).length > 0;
}

function hasUncheckedEvents(uncheckedEventArray: any) {
  return Array.isArray(uncheckedEventArray) && uncheckedEventArray.length > 0;
}

function hasExplicitTurnEntry(data: any) {
  return (
    hasCommandResult(data?.command_result)
    || hasUncheckedEvents(data?.unchecked_event_array)
  );
}

function buildSnapshot(chara: any, data?: any): TrainingHistoryTurnSnapshot {
  const venusDataSet = data?.venus_data_set;
  return {
    speed: Number(chara?.speed ?? 0),
    stamina: Number(chara?.stamina ?? 0),
    power: Number(chara?.power ?? 0),
    guts: Number(chara?.guts ?? 0),
    wiz: Number(chara?.wiz ?? 0),
    skillPoint: Number(chara?.skill_point ?? 0),
    motivation: Number(chara?.motivation ?? 0),
    vital: Number(chara?.vital ?? 0),
    maxVital: Number(chara?.max_vital ?? 0),
    effectIds: Array.isArray(chara?.chara_effect_id_array)
      ? chara.chara_effect_id_array
          .map((id: unknown) => Number(id))
          .filter((id: number) => Number.isFinite(id))
      : [],
    skills: Array.isArray(chara?.skill_array)
      ? chara.skill_array.map(
          (skill: any): TrainingHistorySkill => ({
            skillId: Number(skill?.skill_id ?? 0),
            level: Number(skill?.level ?? 0),
          }),
        )
      : [],
    skillTips: Array.isArray(chara?.skill_tips_array)
      ? chara.skill_tips_array.map(
          (tip: any): TrainingHistorySkillTip => ({
            groupId: Number(tip?.group_id ?? 0),
            rarity: Number(tip?.rarity ?? 0),
            level: Number(tip?.level ?? 0),
          }),
        )
      : [],
    venusSpirits: Array.isArray(venusDataSet?.spirit_info_array)
      ? venusDataSet.spirit_info_array.map((item: any) => ({
          spiritNum: Number(item?.spirit_num ?? 0),
          spiritId: Number(item?.spirit_id ?? 0),
          effectGroupId: Number(item?.effect_group_id ?? 0),
        }))
      : [],
    venusGoddessLevels: Array.isArray(venusDataSet?.venus_chara_info_array)
      ? venusDataSet.venus_chara_info_array.map((item: any) => ({
          charaId: Number(item?.chara_id ?? 0),
          venusLevel: Number(item?.venus_level ?? 0),
        }))
      : [],
  };
}

function buildDelta(
  from: TrainingHistoryTurnSnapshot | null,
  to: TrainingHistoryTurnSnapshot | null,
): TrainingHistoryTurnDelta | null {
  if (!from || !to) return null;

  const fromEffects = new Set(from.effectIds ?? []);
  const toEffects = new Set(to.effectIds ?? []);
  const fromVenusSpiritList = from.venusSpirits ?? [];
  const toVenusSpiritList = to.venusSpirits ?? [];
  const fromVenusGoddessLevels = from.venusGoddessLevels ?? [];
  const toVenusGoddessLevels = to.venusGoddessLevels ?? [];
  const fromVenusSpirits = new Map(
    fromVenusSpiritList.map((item) => [item.spiritNum, item]),
  );
  const toVenusSpirits = new Map(
    toVenusSpiritList.map((item) => [item.spiritNum, item]),
  );
  const allGoddessIds = new Set([
    ...fromVenusGoddessLevels.map((item) => item.charaId),
    ...toVenusGoddessLevels.map((item) => item.charaId),
  ]);
  const fromGoddessLevels = new Map(
    fromVenusGoddessLevels.map((item) => [item.charaId, item.venusLevel]),
  );
  const toGoddessLevels = new Map(
    toVenusGoddessLevels.map((item) => [item.charaId, item.venusLevel]),
  );

  return {
    speed: to.speed - from.speed,
    stamina: to.stamina - from.stamina,
    power: to.power - from.power,
    guts: to.guts - from.guts,
    wiz: to.wiz - from.wiz,
    skillPoint: to.skillPoint - from.skillPoint,
    motivation: to.motivation - from.motivation,
    vital: to.vital - from.vital,
    addedEffectIds: (to.effectIds ?? []).filter((id) => !fromEffects.has(id)),
    removedEffectIds: (from.effectIds ?? []).filter((id) => !toEffects.has(id)),
    addedVenusSpirits: toVenusSpiritList.filter(
      (item) => !fromVenusSpirits.has(item.spiritNum),
    ),
    removedVenusSpirits: fromVenusSpiritList.filter(
      (item) => !toVenusSpirits.has(item.spiritNum),
    ),
    venusLevelChanges: Array.from(allGoddessIds)
      .map((charaId) => ({
        charaId,
        beforeLevel: fromGoddessLevels.get(charaId) ?? 0,
        afterLevel: toGoddessLevels.get(charaId) ?? 0,
      }))
      .filter((item) => item.beforeLevel !== item.afterLevel),
  };
}

function hasMeaningfulDelta(delta: TrainingHistoryTurnDelta | null) {
  if (!delta) return false;
  return (
    delta.speed !== 0
    || delta.stamina !== 0
    || delta.power !== 0
    || delta.guts !== 0
    || delta.wiz !== 0
    || delta.skillPoint !== 0
    || delta.motivation !== 0
    || delta.vital !== 0
    || delta.addedEffectIds.length > 0
    || delta.removedEffectIds.length > 0
    || delta.addedVenusSpirits.length > 0
    || delta.removedVenusSpirits.length > 0
    || delta.venusLevelChanges.length > 0
  );
}

function buildAnalysis(
  record: Pick<TrainingHistoryRecord, 'packets' | 'updatedAt'>,
): TrainingHistoryAnalysis {
  let viewerId = 0;
  let singleModeCharaId = 0;
  let cardId = 0;
  let rarity = 0;
  let startTime: string | number | Date | undefined;
  let supportCards: TrainingHistorySummary['supportCards'] = [];
  const packetSnapshots = new Map<number, TrainingHistoryTurnSnapshot>();
  const packetTurns = new Map<number, number>();
  const packetPayloads = new Map<number, any>();
  const turnsByNumber = new Map<number, TrainingHistoryTurn>();

  record.packets.forEach((packet, packetIndex) => {
    const payload = packet.payload as any;
    if (isUMASingleModelResponse(payload)) {
      viewerId = payload.data_headers.viewer_id ?? viewerId;
    }

    const data = getPacketData(packet);
    const chara = data?.chara_info;
    if (!chara) return;

    singleModeCharaId = chara.single_mode_chara_id ?? singleModeCharaId;
    cardId = chara.card_id ?? cardId;
    rarity = chara.rarity ?? rarity;
    startTime = chara.start_time ?? startTime;
    const snapshot = buildSnapshot(chara, data);
    packetSnapshots.set(packetIndex, snapshot);
    packetTurns.set(packetIndex, Number(chara.turn ?? 0));
    packetPayloads.set(packetIndex, data);
    supportCards = (chara.support_card_array ?? []).map((card: any) => ({
      position: card.position ?? 0,
      supportCardId: card.support_card_id ?? 0,
      limitBreak: card.limit_break_count ?? 0,
      exp: card.exp ?? 0,
    }));
  });

  record.packets.forEach((packet, packetIndex) => {
    const data = packetPayloads.get(packetIndex);
    const snapshot = packetSnapshots.get(packetIndex);
    const turnNumber = packetTurns.get(packetIndex);
    if (!data || !snapshot || turnNumber == null) return;

    const turn = turnsByNumber.get(turnNumber) ?? {
      turn: turnNumber,
      snapshot,
      entries: [],
    };

    if (hasCommandResult(data.command_result)) {
      const previousData = packetPayloads.get(packetIndex - 1);
      turn.entries.push({
        type: 'command',
        packetIndex,
        receivedAt: packet.receivedAt,
        commandResult: data.command_result,
        trainingEstimate: buildTrainingEstimate(
          data.command_result,
          previousData,
        ),
        delta: buildDelta(
          packetSnapshots.get(packetIndex - 1) ?? null,
          snapshot,
        ),
      });
    }

    const rawEvents = data.unchecked_event_array ?? [];

    rawEvents.forEach((event: any) => {
      turn.entries.push({
        type: 'event',
        packetIndex,
        receivedAt: packet.receivedAt,
        event,
        storyId: event?.story_id,
        delta: buildDelta(
          snapshot,
          packetSnapshots.get(packetIndex + 1) ?? null,
        ),
      });
    });
    const previousData = packetPayloads.get(packetIndex - 1);

    if (!hasExplicitTurnEntry(data) && !hasExplicitTurnEntry(previousData)) {
      const delta = buildDelta(
        packetSnapshots.get(packetIndex - 1) ?? null,
        snapshot,
      );
      if (hasMeaningfulDelta(delta)) {
        turn.entries.push({
          type: 'delta',
          packetIndex,
          receivedAt: packet.receivedAt,
          title: '变动内容',
          delta,
        });
      }
    }

    if (turn.entries.length > 0) {
      turnsByNumber.set(turnNumber, turn);
    }
  });

  const turns = Array.from(turnsByNumber.values()).sort(
    (a, b) => a.turn - b.turn,
  );
  const summary: TrainingHistorySummary = {
    viewerId,
    singleModeCharaId,
    cardId,
    rarity,
    startTime,
    updatedAt: record.updatedAt,
    packetCount: record.packets.length,
    turnCount: turns.length,
    supportCards,
  };

  return {
    version: ANALYSIS_VERSION,
    summary,
    turns,
  };
}

function recomputeRecord(record: TrainingHistoryRecord) {
  record.analysis = buildAnalysis(record);
  record.summary = {
    ...record.analysis.summary,
    updatedAt: record.updatedAt,
  };
  writeRecord(record);
  writeRecordSummary(record);
  liveRecordCache.set(record.id, record);
  return record;
}

function trimRecords() {
  const config = readConfig();
  const favoriteIds = getFavoriteIdSet(config);
  const records = recordFiles()
    .map(readRecordSummary)
    .filter((record): record is TrainingHistoryRecord => !!record)
    .map((record) => applyFavorite(record, favoriteIds))
    .filter((record): record is TrainingHistoryRecord => !!record)
    .filter((record) => !record.favorite)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  records.slice(config.maxCachedRuns).forEach((record) => {
    try {
      [recordMetaPath(record.id), recordPacketLogPath(record.id), recordPath(record.id)]
        .forEach((file) => {
          if (fs.existsSync(file)) {
            fs.unlinkSync(file);
          }
        });
      liveRecordCache.delete(record.id);
    } catch (error) {
      log.error(
        '[TrainingHistory] Failed to trim record:',
        record.fullPath,
        error,
      );
    }
  });
}

export function handleTrainingHistoryInfo(
  decodedData: unknown,
  win: BrowserWindow,
) {
  if (!isUMASingleModelResponse(decodedData)) return;

  const normalizedData = normalizeSingleModeData(
    decodedData.data as Record<string, any>,
  );
  const chara = normalizedData.chara_info;
  const viewerId = decodedData.data_headers.viewer_id;
  const singleModeCharaId = chara?.single_mode_chara_id;
  if (viewerId == null || singleModeCharaId == null) return;

  ensureTrainingHistoryDir();
  const id = `${viewerId}_${singleModeCharaId}`;
  const fullPath = recordPath(id);
  const filename = path.basename(fullPath);
  const now = Date.now();
  const packet: TrainingHistoryPacket = {
    sequence: 0,
    receivedAt: now,
    payload: decodedData,
  };

  const existing = liveRecordCache.get(id) ?? materializeRecord(id);
  const record: TrainingHistoryRecord = existing ?? {
    id,
    filename,
    fullPath,
    createdAt: now,
    updatedAt: now,
    favorite: getFavoriteIdSet().has(id),
    summary: {
      viewerId,
      singleModeCharaId,
      cardId: chara.card_id ?? 0,
      rarity: chara.rarity ?? 0,
      startTime: chara.start_time,
      updatedAt: now,
      packetCount: 0,
      turnCount: 0,
      supportCards: [],
    },
    analysis: {
      version: ANALYSIS_VERSION,
      summary: {
        viewerId,
        singleModeCharaId,
        cardId: chara.card_id ?? 0,
        rarity: chara.rarity ?? 0,
        startTime: chara.start_time,
        updatedAt: now,
        packetCount: 0,
        turnCount: 0,
        supportCards: [],
      },
      turns: [],
    },
    packets: [],
  };

  packet.sequence = record.packets.length;
  record.updatedAt = now;
  record.packets.push(packet);
  record.analysis = buildAnalysis(record);
  record.summary = {
    ...record.analysis.summary,
    updatedAt: now,
  };

  try {
    appendPacketToJsonl(recordPacketLogPath(id), packet);
    writeRecordSummary(record);
    deleteMaterializedRecord(id);
    liveRecordCache.set(id, record);
    trimRecords();
    win.webContents.send('training-history:new', toClientRecord(record));
  } catch (error) {
    log.error('[TrainingHistory] Save failed:', error);
  }
}

export function handleTrainingHistoryList(ipcMain: IpcMain) {
  ipcMain.handle('training-history:list', async () => {
    migrateAllLegacyRecords();
    const favoriteIds = getFavoriteIdSet();
    const records = recordFiles()
      .map(readRecordSummary)
      .filter((record): record is TrainingHistoryRecord => !!record)
      .map((record) => applyFavorite(record, favoriteIds))
      .filter((record): record is TrainingHistoryRecord => !!record)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map(toClientRecord);
    return records;
  });

  ipcMain.handle('training-history:get', async (_, id: string) => {
    migrateAllLegacyRecords();
    const record = materializeRecord(id);
    return record ? toClientRecord(record) : null;
  });

  ipcMain.handle('training-history:config-get', async () => readConfig());

  ipcMain.handle(
    'training-history:config-set',
    async (_, incoming: Partial<TrainingHistoryConfig>) => {
      const maxCachedRuns = Math.max(
        1,
        Math.floor(Number(incoming?.maxCachedRuns) || DEFAULT_MAX_CACHED_RUNS),
      );
      const currentConfig = readConfig();
      const config = {
        maxCachedRuns,
        favoriteIds: currentConfig.favoriteIds,
      };
      writeConfig(config);
      trimRecords();
      return config;
    },
  );

  ipcMain.handle(
    'training-history:favorite',
    async (_, id: string, favorite: boolean) => {
      const config = readConfig();
      const favoriteIds = getFavoriteIdSet(config);
      if (favorite) favoriteIds.add(id);
      else favoriteIds.delete(id);

      writeConfig({
        ...config,
        favoriteIds: Array.from(favoriteIds),
      });

      const record = readSummaryRecordById(id) ?? materializeRecord(id);
      if (!record) return null;
      record.favorite = favoriteIds.has(id);
      liveRecordCache.set(id, record);
      trimRecords();
      return toClientRecord(record);
    },
  );

  ipcMain.handle('training-history:open-folder', async (_, id: string) => {
    const fullFile = recordPath(id);
    const metaFile = recordMetaPath(id);
    if (fs.existsSync(fullFile)) {
      shell.showItemInFolder(fullFile);
      return true;
    }
    if (fs.existsSync(metaFile)) {
      shell.showItemInFolder(metaFile);
      return true;
    }
    return false;
  });

  ipcMain.handle('training-history:delete', async (_, ids: string[]) => {
    const config = readConfig();
    const favoriteIds = getFavoriteIdSet(config);

    ids.forEach((id) => {
      favoriteIds.delete(id);
      liveRecordCache.delete(id);
      [recordPath(id), recordMetaPath(id), recordPacketLogPath(id)].forEach(
        (file) => {
          if (fs.existsSync(file)) {
            fs.unlinkSync(file);
          }
        },
      );
    });

    if (favoriteIds.size !== config.favoriteIds.length) {
      writeConfig({
        ...config,
        favoriteIds: Array.from(favoriteIds),
      });
    }

    return true;
  });

  ipcMain.handle('training-history:recalculate', async (_, ids?: string[]) => {
    const targetIds = Array.isArray(ids) && ids.length > 0
      ? ids
      : recordFiles()
          .map(readRecordSummary)
          .filter((record): record is TrainingHistoryRecord => !!record)
          .map((record) => record.id);

    const updatedRecords = targetIds
      .map((id) => materializeRecord(id))
      .filter((record): record is TrainingHistoryRecord => !!record)
      .map(recomputeRecord)
      .map(toClientRecord);

    return updatedRecords;
  });
}

export function ensureTrainingHistory() {
  ensureTrainingHistoryDir();
  if (!fs.existsSync(configPath())) {
    writeConfig({ maxCachedRuns: DEFAULT_MAX_CACHED_RUNS, favoriteIds: [] });
  }
  migrateAllLegacyRecords();
}
