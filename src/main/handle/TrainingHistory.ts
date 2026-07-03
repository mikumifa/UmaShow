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

function recordPath(id: string) {
  return path.join(
    TRAINING_HISTORY_DIR,
    `training_history_${sanitizeRecordId(id)}.json`,
  );
}

function readConfig(): TrainingHistoryConfig {
  ensureTrainingHistoryDir();
  if (!fs.existsSync(configPath())) {
    return { maxCachedRuns: DEFAULT_MAX_CACHED_RUNS };
  }

  try {
    const parsed = JSON.parse(
      fs.readFileSync(configPath(), 'utf-8'),
    ) as Partial<TrainingHistoryConfig>;
    const maxCachedRuns = Number(parsed.maxCachedRuns);
    return {
      maxCachedRuns:
        Number.isFinite(maxCachedRuns) && maxCachedRuns > 0
          ? Math.floor(maxCachedRuns)
          : DEFAULT_MAX_CACHED_RUNS,
    };
  } catch (error) {
    log.error('[TrainingHistory] Failed to read config:', error);
    return { maxCachedRuns: DEFAULT_MAX_CACHED_RUNS };
  }
}

function writeConfig(config: TrainingHistoryConfig) {
  ensureTrainingHistoryDir();
  fs.writeFileSync(
    configPath(),
    JSON.stringify(config, jsonReplacer, 2),
    'utf-8',
  );
}

function recordFiles() {
  ensureTrainingHistoryDir();
  return fs
    .readdirSync(TRAINING_HISTORY_DIR)
    .filter(
      (file) => file.startsWith('training_history_') && file.endsWith('.json'),
    )
    .map((file) => path.join(TRAINING_HISTORY_DIR, file));
}

function readRecord(file: string): TrainingHistoryRecord | null {
  try {
    const record = JSON.parse(
      fs.readFileSync(file, 'utf-8'),
    ) as TrainingHistoryRecord;
    record.fullPath = file;
    if (
      record.analysis?.version !== ANALYSIS_VERSION &&
      Array.isArray(record.packets)
    ) {
      record.analysis = buildAnalysis(record);
      record.summary = record.analysis.summary;
      fs.writeFileSync(file, JSON.stringify(record, jsonReplacer, 2), 'utf-8');
    }
    return record;
  } catch (error) {
    log.error('[TrainingHistory] Failed to parse record:', file, error);
    return null;
  }
}

function recomputeRecord(record: TrainingHistoryRecord) {
  record.analysis = buildAnalysis(record);
  record.summary = {
    ...record.analysis.summary,
    updatedAt: record.updatedAt,
  };
  writeRecord(record);
  return record;
}

function toClientRecord(record: TrainingHistoryRecord): TrainingHistoryRecord {
  return {
    ...record,
    packets: [],
  };
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
    hasCommandResult(data?.command_result) ||
    hasUncheckedEvents(data?.unchecked_event_array)
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
    delta.speed !== 0 ||
    delta.stamina !== 0 ||
    delta.power !== 0 ||
    delta.guts !== 0 ||
    delta.wiz !== 0 ||
    delta.skillPoint !== 0 ||
    delta.motivation !== 0 ||
    delta.vital !== 0 ||
    delta.addedEffectIds.length > 0 ||
    delta.removedEffectIds.length > 0 ||
    delta.addedVenusSpirits.length > 0 ||
    delta.removedVenusSpirits.length > 0 ||
    delta.venusLevelChanges.length > 0
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

function writeRecord(record: TrainingHistoryRecord) {
  fs.writeFileSync(
    record.fullPath,
    JSON.stringify(record, jsonReplacer, 2),
    'utf-8',
  );
}

function trimRecords() {
  const config = readConfig();
  const records = recordFiles()
    .map(readRecord)
    .filter((record): record is TrainingHistoryRecord => !!record)
    .filter((record) => !record.favorite)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  records.slice(config.maxCachedRuns).forEach((record) => {
    try {
      fs.unlinkSync(record.fullPath);
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

  const existing = fs.existsSync(fullPath) ? readRecord(fullPath) : null;
  const record: TrainingHistoryRecord = existing ?? {
    id,
    filename,
    fullPath,
    createdAt: now,
    updatedAt: now,
    favorite: false,
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
  record.summary = record.analysis.summary;
  record.summary.updatedAt = now;

  try {
    writeRecord(record);
    trimRecords();
    win.webContents.send('training-history:new', toClientRecord(record));
  } catch (error) {
    log.error('[TrainingHistory] Save failed:', error);
  }
}

export function handleTrainingHistoryList(ipcMain: IpcMain) {
  ipcMain.handle('training-history:list', async () => {
    const records = recordFiles()
      .map(readRecord)
      .filter((record): record is TrainingHistoryRecord => !!record)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map(toClientRecord);
    return records;
  });

  ipcMain.handle('training-history:config-get', async () => readConfig());

  ipcMain.handle(
    'training-history:config-set',
    async (_, incoming: Partial<TrainingHistoryConfig>) => {
      const maxCachedRuns = Math.max(
        1,
        Math.floor(Number(incoming?.maxCachedRuns) || DEFAULT_MAX_CACHED_RUNS),
      );
      const config = { maxCachedRuns };
      writeConfig(config);
      trimRecords();
      return config;
    },
  );

  ipcMain.handle(
    'training-history:favorite',
    async (_, id: string, favorite: boolean) => {
      const file = recordPath(id);
      const record = fs.existsSync(file) ? readRecord(file) : null;
      if (!record) return null;
      record.favorite = !!favorite;
      writeRecord(record);
      trimRecords();
      return toClientRecord(record);
    },
  );

  ipcMain.handle('training-history:open-folder', async (_, id: string) => {
    const file = recordPath(id);
    if (!fs.existsSync(file)) return false;
    shell.showItemInFolder(file);
    return true;
  });

  ipcMain.handle('training-history:delete', async (_, ids: string[]) => {
    ids.forEach((id) => {
      const file = recordPath(id);
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });
    return true;
  });

  ipcMain.handle('training-history:recalculate', async (_, ids?: string[]) => {
    const targetFiles =
      Array.isArray(ids) && ids.length > 0
        ? ids.map((id) => recordPath(id)).filter((file) => fs.existsSync(file))
        : recordFiles();

    const updatedRecords = targetFiles
      .map(readRecord)
      .filter((record): record is TrainingHistoryRecord => !!record)
      .map(recomputeRecord)
      .map(toClientRecord);

    return updatedRecords;
  });
}

export function ensureTrainingHistory() {
  ensureTrainingHistoryDir();
  if (!fs.existsSync(configPath())) {
    writeConfig({ maxCachedRuns: DEFAULT_MAX_CACHED_RUNS });
  }
}
