import { createStore, del, entries, get, set } from 'idb-keyval';
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
const DEFAULT_CONFIG: TrainingHistoryConfig = {
  maxCachedRuns: 50,
  favoriteIds: [],
};
const listeners = new Set<(record?: TrainingHistoryRecord) => void>();

function recordKey(id: string) {
  return `${RECORD_PREFIX}${id}`;
}

function toClientRecord(record: TrainingHistoryRecord) {
  return { ...record, packets: [] };
}

async function storedRecords() {
  const values = await entries<string, unknown>(store);
  return values.flatMap(([key, value]) =>
    key.startsWith(RECORD_PREFIX) && value && typeof value === 'object'
      ? [value as TrainingHistoryRecord]
      : [],
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
  const records = (await storedRecords())
    .filter((record) => !record.favorite)
    .sort((left, right) => right.updatedAt - left.updatedAt);
  await Promise.all(
    records
      .slice(Math.max(1, config.maxCachedRuns))
      .map((record) => del(recordKey(record.id), store)),
  );
}

export async function listMobileTrainingHistory() {
  return (await storedRecords())
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .map(toClientRecord);
}

export async function getMobileTrainingHistory(id: string) {
  const record = await get<TrainingHistoryRecord>(recordKey(id), store);
  return record ? toClientRecord(record) : null;
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
  await set(recordKey(id), record, store);
  await trimMobileTrainingHistory();
  await notify(toClientRecord(record));
  return toClientRecord(record);
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
  const record = await get<TrainingHistoryRecord>(recordKey(id), store);
  if (!record) return null;
  record.favorite = favorite;
  await set(recordKey(id), record, store);
  const current = await getMobileTrainingHistoryConfig();
  const favoriteIds = new Set(current.favoriteIds);
  if (favorite) favoriteIds.add(id);
  else favoriteIds.delete(id);
  await set(CONFIG_KEY, { ...current, favoriteIds: [...favoriteIds] }, store);
  await trimMobileTrainingHistory();
  return toClientRecord(record);
}

export async function deleteMobileTrainingHistory(ids: string[]) {
  await Promise.all(ids.map((id) => del(recordKey(id), store)));
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
  const wanted = ids?.length ? new Set(ids) : null;
  const records = (await storedRecords()).filter(
    (record) => !wanted || wanted.has(record.id),
  );
  const updated = await Promise.all(
    records.map(async (record) => {
      record.analysis = buildTrainingHistoryAnalysis(record);
      record.summary = {
        ...record.analysis.summary,
        updatedAt: record.updatedAt,
      };
      await set(recordKey(record.id), record, store);
      return toClientRecord(record);
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
