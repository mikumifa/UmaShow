import {
  createStore,
  delMany,
  get,
  getMany,
  keys,
  set,
  setMany,
} from 'idb-keyval';
import { buildTrainingHistoryAnalysis } from 'main/handle/TrainingHistory';
import type {
  TrainingHistoryConfig,
  TrainingHistoryPacket,
  TrainingHistoryRecord,
  TrainingHistorySummary,
} from 'types/gameTypes';

type RemoteTrainingHistory = {
  id: string;
  meta?: Partial<TrainingHistoryRecord>;
  packets?: TrainingHistoryPacket[];
};

const store = createStore('autouma', 'training-history');
const CONFIG_KEY = 'config';
const RECORD_PREFIX = 'record:';
const SUMMARY_PREFIX = 'summary:';
const DETAIL_PREFIX = 'detail:';
const DEFAULT_CONFIG: TrainingHistoryConfig = {
  maxCachedRuns: 50,
  favoriteIds: [],
};
const listeners = new Set<(record?: TrainingHistoryRecord) => void>();

function recordKey(id: string) {
  return `${RECORD_PREFIX}${id}`;
}

function summaryKey(id: string) {
  return `${SUMMARY_PREFIX}${id}`;
}

function detailKey(id: string) {
  return `${DETAIL_PREFIX}${id}`;
}

function toClientRecord(record: TrainingHistoryRecord): TrainingHistoryRecord {
  return { ...record, packets: [] };
}

function toSummaryRecord(record: TrainingHistoryRecord): TrainingHistoryRecord {
  return {
    ...record,
    analysis: {
      version: record.analysis?.version ?? 0,
      summary: record.analysis?.summary || record.summary,
      turns: [],
    },
    packets: [],
  };
}

async function persistRecord(record: TrainingHistoryRecord) {
  await setMany(
    [
      [recordKey(record.id), record],
      [detailKey(record.id), toClientRecord(record)],
      [summaryKey(record.id), toSummaryRecord(record)],
    ],
    store,
  );
}

async function storedSummaries(): Promise<TrainingHistoryRecord[]> {
  const allKeys = (await keys<string>(store)).map(String);
  const recordIds = allKeys
    .filter((key) => key.startsWith(RECORD_PREFIX))
    .map((key) => key.slice(RECORD_PREFIX.length));
  if (!recordIds.length) return [];

  const summaryKeySet = new Set(
    allKeys.filter((key) => key.startsWith(SUMMARY_PREFIX)),
  );
  const missingMigrationIds = recordIds.filter(
    (id) => !summaryKeySet.has(summaryKey(id)),
  );
  if (missingMigrationIds.length) {
    const legacyRecords = await getMany<TrainingHistoryRecord>(
      missingMigrationIds.map(recordKey),
      store,
    );
    const migrationEntries: Array<[string, TrainingHistoryRecord]> = [];
    legacyRecords.forEach((record) => {
      if (!record || typeof record !== 'object') return;
      migrationEntries.push([detailKey(record.id), toClientRecord(record)]);
      migrationEntries.push([summaryKey(record.id), toSummaryRecord(record)]);
    });
    if (migrationEntries.length) {
      await setMany(migrationEntries, store);
    }
  }

  const summaries = await getMany<TrainingHistoryRecord>(
    recordIds.map(summaryKey),
    store,
  );
  return summaries.filter((item): item is TrainingHistoryRecord =>
    Boolean(item && typeof item === 'object'),
  );
}

async function notify(record?: TrainingHistoryRecord) {
  listeners.forEach((listener) => listener(record));
}

export async function getMobileTrainingHistoryConfig() {
  return (
    (await get<TrainingHistoryConfig>(CONFIG_KEY, store)) || DEFAULT_CONFIG
  );
}

async function trimMobileTrainingHistory() {
  const config = await getMobileTrainingHistoryConfig();
  const summaries = (await storedSummaries())
    .filter((record) => !record.favorite)
    .sort((left, right) => right.updatedAt - left.updatedAt);
  const expiredIds = summaries
    .slice(Math.max(1, config.maxCachedRuns))
    .map((record) => record.id);
  if (!expiredIds.length) return;
  await delMany(
    expiredIds.flatMap((id) => [recordKey(id), detailKey(id), summaryKey(id)]),
    store,
  );
}

export async function listMobileTrainingHistory() {
  return (await storedSummaries()).sort(
    (left, right) => right.updatedAt - left.updatedAt,
  );
}

export async function getMobileTrainingHistory(id: string) {
  const detail = await get<TrainingHistoryRecord>(detailKey(id), store);
  if (detail) return detail;
  const record = await get<TrainingHistoryRecord>(recordKey(id), store);
  if (!record) return null;
  const clientRecord = toClientRecord(record);
  await setMany(
    [
      [detailKey(id), clientRecord],
      [summaryKey(id), toSummaryRecord(record)],
    ],
    store,
  );
  return clientRecord;
}

export async function importMobileTrainingHistory(
  incoming: RemoteTrainingHistory,
) {
  const id = String(incoming?.id || '').trim();
  if (!id || id.replace(/[^\w-]+/g, '_') !== id) {
    throw new Error('服务器 Training History 标识无效');
  }
  const incomingPackets = Array.isArray(incoming?.packets)
    ? incoming.packets.filter(
        (packet): packet is TrainingHistoryPacket =>
          Boolean(packet && typeof packet === 'object' && packet.payload != null),
      )
    : [];
  if (!incomingPackets.length) {
    throw new Error('服务器 Training History 没有可导入的数据包');
  }

  const existing = await get<TrainingHistoryRecord>(recordKey(id), store);
  const fingerprints = new Set<string>();
  const packets: TrainingHistoryPacket[] = [];
  [...(existing?.packets || []), ...incomingPackets]
    .sort(
      (left, right) =>
        Number(left.receivedAt || 0) - Number(right.receivedAt || 0) ||
        Number(left.sequence || 0) - Number(right.sequence || 0),
    )
    .forEach((packet) => {
      const fingerprint = JSON.stringify({
        endpoint: packet.endpoint || '',
        request: packet.request || {},
        payload: packet.payload,
      });
      if (fingerprints.has(fingerprint)) return;
      fingerprints.add(fingerprint);
      packets.push({
        ...packet,
        sequence: packets.length,
        receivedAt: Number(packet.receivedAt || Date.now()),
      });
    });

  const incomingMeta = incoming.meta || {};
  const [viewerId, singleModeCharaId] = id.split('_').map(Number);
  const updatedAt = Math.max(
    Date.now(),
    Number(existing?.updatedAt || 0),
    Number(incomingMeta.updatedAt || 0),
  );
  const fallbackSummary: TrainingHistorySummary = {
    viewerId: Number(viewerId || 0),
    singleModeCharaId: Number(singleModeCharaId || 0),
    cardId: 0,
    rarity: 0,
    updatedAt,
    packetCount: packets.length,
    turnCount: 0,
    supportCards: [],
  };
  const createdAtValues = [existing?.createdAt, incomingMeta.createdAt]
    .map(Number)
    .filter((value) => Number.isFinite(value) && value > 0);
  const record: TrainingHistoryRecord = {
    id,
    filename: `training_history_${id}.json`,
    fullPath: `AutoUma/TrainingHistory/${id}`,
    createdAt: createdAtValues.length ? Math.min(...createdAtValues) : updatedAt,
    updatedAt,
    favorite: Boolean(existing?.favorite),
    status: String(incomingMeta.status || existing?.status || ''),
    summary: existing?.summary || incomingMeta.summary || fallbackSummary,
    analysis: existing?.analysis ||
      incomingMeta.analysis || {
        version: 0,
        summary: fallbackSummary,
        turns: [],
      },
    packets,
  };
  record.analysis = buildTrainingHistoryAnalysis(record);
  record.summary = { ...record.analysis.summary, updatedAt };
  await persistRecord(record);
  await trimMobileTrainingHistory();
  const summaryRecord = toSummaryRecord(record);
  await notify(summaryRecord);
  return summaryRecord;
}

export async function setMobileTrainingHistoryConfig(payload: {
  maxCachedRuns: number;
}) {
  const current = await getMobileTrainingHistoryConfig();
  const config: TrainingHistoryConfig = {
    ...current,
    maxCachedRuns: Math.max(1, Math.floor(Number(payload.maxCachedRuns) || 50)),
  };
  await set(CONFIG_KEY, config, store);
  await trimMobileTrainingHistory();
  return config;
}

export async function setMobileTrainingHistoryFavorite(
  id: string,
  favorite: boolean,
) {
  const [summary, detail, record] = await getMany<TrainingHistoryRecord>(
    [summaryKey(id), detailKey(id), recordKey(id)],
    store,
  );
  const base = summary || detail || record;
  if (!base) return null;
  const updates: Array<[string, TrainingHistoryRecord]> = [];
  if (record) updates.push([recordKey(id), { ...record, favorite }]);
  if (detail) updates.push([detailKey(id), { ...detail, favorite }]);
  const nextSummary = toSummaryRecord({ ...base, favorite });
  updates.push([summaryKey(id), nextSummary]);
  await setMany(updates, store);
  const current = await getMobileTrainingHistoryConfig();
  const favoriteIds = new Set(current.favoriteIds);
  if (favorite) favoriteIds.add(id);
  else favoriteIds.delete(id);
  await set(CONFIG_KEY, { ...current, favoriteIds: [...favoriteIds] }, store);
  await trimMobileTrainingHistory();
  return nextSummary;
}

export async function deleteMobileTrainingHistory(ids: string[]) {
  if (ids.length) {
    await delMany(
      ids.flatMap((id) => [recordKey(id), detailKey(id), summaryKey(id)]),
      store,
    );
  }
  const current = await getMobileTrainingHistoryConfig();
  const deleted = new Set(ids);
  await set(
    CONFIG_KEY,
    {
      ...current,
      favoriteIds: current.favoriteIds.filter((id) => !deleted.has(id)),
    },
    store,
  );
  await notify();
  return true;
}

export async function recalculateMobileTrainingHistory(ids?: string[]) {
  const allKeys = (await keys<string>(store)).map(String);
  const wanted = ids?.length ? new Set(ids) : null;
  const targetIds = allKeys
    .filter((key) => key.startsWith(RECORD_PREFIX))
    .map((key) => key.slice(RECORD_PREFIX.length))
    .filter((id) => !wanted || wanted.has(id));
  if (!targetIds.length) {
    await notify();
    return [];
  }
  const records = await getMany<TrainingHistoryRecord>(
    targetIds.map(recordKey),
    store,
  );
  const updated = await Promise.all(
    records
      .filter((record): record is TrainingHistoryRecord =>
        Boolean(record && typeof record === 'object'),
      )
      .map(async (record) => {
        record.analysis = buildTrainingHistoryAnalysis(record);
        record.summary = {
          ...record.analysis.summary,
          updatedAt: record.updatedAt,
        };
        await persistRecord(record);
        return toSummaryRecord(record);
      }),
  );
  await notify();
  return updated;
}

export function onMobileTrainingHistoryNew(
  callback: (record?: TrainingHistoryRecord) => void,
) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}
