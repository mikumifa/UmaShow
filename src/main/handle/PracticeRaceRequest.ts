import type { RaceHorseInfo, RaceMetaInfo } from 'types/gameTypes';

export type PracticeRaceSource = {
  raceMetaInfo: RaceMetaInfo;
  horses: RaceHorseInfo[];
};

export type PracticeRaceEntry = {
  viewer_id: number;
  trained_chara_id: number;
  running_style: number;
  entry_id: number;
};

export type PracticeRaceStartPayload = {
  race_instance_id: number;
  season: number;
  weather: number;
  ground_condition: number;
  race_time: number;
  motivation: number;
  entry_num: number;
  entry_chara_array: PracticeRaceEntry[];
};

type PracticeRacePartnerOwnerInfo = {
  partner_trained_chara_id?: unknown;
  owner_viewer_id?: unknown;
  owner_name?: unknown;
  owner_trained_chara_id?: unknown;
  friend_state?: unknown;
};

type PracticeRaceResponseData = {
  practice_partner_owner_info_array?: PracticeRacePartnerOwnerInfo[];
  trained_chara_array?: PracticeRacePartnerOwnerInfo[];
};

function finiteNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function requiredPositiveNumber(value: unknown, label: string) {
  const parsed = finiteNumber(value);
  if (parsed == null || parsed <= 0) {
    throw new Error(`当前 RaceData 缺少有效的${label}`);
  }
  return parsed;
}

/**
 * race_horse_data_array only keeps the account-side partner id for borrowed
 * characters. Keep the owner mapping returned beside it so a saved RaceData
 * record remains sufficient to identify the borrowed character later.
 */
export function enrichPracticeRaceHorses(
  horses: RaceHorseInfo[],
  responseData: PracticeRaceResponseData,
) {
  if (!Array.isArray(horses) || horses.length === 0) return horses;

  const partnerByLocalId = new Map<number, PracticeRacePartnerOwnerInfo>();
  const rememberMappings = (rows: unknown) => {
    if (!Array.isArray(rows)) return;
    rows.forEach((row) => {
      const partnerId = finiteNumber(row?.partner_trained_chara_id);
      const trainedCharaId = finiteNumber(row?.trained_chara_id);
      const ownerViewerId = finiteNumber(row?.owner_viewer_id);
      const localId = partnerId ?? trainedCharaId;
      if (
        localId != null &&
        localId > 0 &&
        ownerViewerId != null &&
        ownerViewerId > 0
      ) {
        partnerByLocalId.set(localId, row);
      }
    });
  };

  // trained_chara_array is a useful fallback; the explicit owner array also
  // carries owner_name/friend_state and therefore takes precedence.
  rememberMappings(responseData?.trained_chara_array);
  rememberMappings(responseData?.practice_partner_owner_info_array);

  if (partnerByLocalId.size === 0) return horses;

  return horses.map((horse) => {
    const localId = finiteNumber(horse?.trained_chara_id);
    const owner = localId == null ? undefined : partnerByLocalId.get(localId);
    if (!owner) return horse;

    const ownerViewerId = finiteNumber(owner.owner_viewer_id);
    const ownerTrainedCharaId = finiteNumber(owner.owner_trained_chara_id);
    const friendState = finiteNumber(owner.friend_state);
    return {
      ...horse,
      ...(ownerViewerId != null ? { owner_viewer_id: ownerViewerId } : {}),
      ...(ownerTrainedCharaId != null
        ? { owner_trained_chara_id: ownerTrainedCharaId }
        : {}),
      ...(typeof owner.owner_name === 'string'
        ? { owner_name: owner.owner_name }
        : {}),
      ...(friendState != null ? { friend_state: friendState } : {}),
    };
  });
}

export function buildPracticeRaceStartPayload(
  source: PracticeRaceSource,
): PracticeRaceStartPayload {
  const meta = source?.raceMetaInfo;
  const horses = Array.isArray(source?.horses) ? source.horses : [];
  if (!meta || horses.length === 0) {
    throw new Error('当前 RaceData 缺少赛事或马匹数据');
  }

  const playableHorses = horses.filter((horse) => {
    const viewerId = finiteNumber(horse?.viewer_id);
    const trainedCharaId = finiteNumber(horse?.trained_chara_id);
    return (
      viewerId != null &&
      viewerId > 0 &&
      trainedCharaId != null &&
      trainedCharaId > 0
    );
  });
  if (playableHorses.length === 0) {
    throw new Error('当前 RaceData 中没有可用于练习的育成马娘');
  }
  if (playableHorses.length > 18) {
    throw new Error('当前 RaceData 的练习参赛马娘超过 18 位，无法构造练习请求');
  }

  const entryCharaArray = playableHorses.map((horse, entryId) => ({
    viewer_id: requiredPositiveNumber(horse.viewer_id, '玩家 ID'),
    trained_chara_id: requiredPositiveNumber(
      horse.trained_chara_id,
      '育成马娘 ID',
    ),
    running_style: requiredPositiveNumber(horse.running_style, '跑法'),
    entry_id: entryId,
  }));

  const firstMotivation = finiteNumber(playableHorses[0]?.motivation);
  const requestedEntryNum = finiteNumber(meta.entry_num);
  const raceTime = finiteNumber(meta.race_time);

  return {
    race_instance_id: requiredPositiveNumber(meta.race_instance_id, '赛事 ID'),
    season: requiredPositiveNumber(meta.season, '季节'),
    weather: requiredPositiveNumber(meta.weather, '天气'),
    ground_condition: requiredPositiveNumber(meta.ground_condition, '场地状态'),
    race_time: raceTime != null && raceTime >= 0 ? raceTime : 0,
    motivation:
      firstMotivation != null && firstMotivation > 0 ? firstMotivation : 5,
    entry_num:
      requestedEntryNum != null && requestedEntryNum >= horses.length
        ? requestedEntryNum
        : horses.length,
    entry_chara_array: entryCharaArray,
  };
}

export function getPracticeRaceSourceViewerId(
  payload: PracticeRaceStartPayload,
) {
  return String(payload.entry_chara_array[0]?.viewer_id ?? '');
}

export function getPracticeRaceSourceViewerIds(
  payload: PracticeRaceStartPayload,
) {
  return [
    ...new Set(
      payload.entry_chara_array
        .map((entry) => String(entry.viewer_id ?? ''))
        .filter(Boolean),
    ),
  ];
}
