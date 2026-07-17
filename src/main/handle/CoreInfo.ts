import https from 'https';
import zlib from 'zlib';
import log from 'electron-log';
import { resolveEventRule } from 'constant/events';
import {
  COMMAND_TO_MASTER_BONUS,
  SPECIALTY_RATE_PLUS_FIVE_EFFECT_IDS,
} from 'constant/live/liveSchedule';
import { BrowserWindow } from 'electron';
import {
  CharStats,
  type CharaEffect,
  GameStats,
  NoteStat,
  type ScenarioType,
  SongStat,
  StoryDetail,
  type VenusData,
} from 'types/gameTypes';
import { isUMASingleModelResponse } from 'types/ingame/UMASingleModelResponse';
import { UMDB } from './Data';

const PERF_TYPE_TO_NOTE_KEY: Record<number, keyof NoteStat> = {
  1: 'da',
  2: 'pa',
  3: 'vo',
  4: 'vi',
  5: 'me',
};

const formatColorHtml = (input: string) => {
  return input
    .replace(/<color=([^>]+)>/g, '<span style="color:$1">')
    .replace(/<\/color>/g, '</span>');
};

const storyDetailCache = new Map<number, StoryDetail>();
const storyDetailInFlight = new Map<number, Promise<StoryDetail | null>>();

const resolveScenarioType = (
  data: Record<string, unknown> | null | undefined,
): ScenarioType => {
  if (data?.venus_data_set != null) {
    return 'venusCup';
  }
  if (data?.live_data_set != null) {
    return 'idolCup';
  }
  return 'unknown';
};

const extractVenusData = (
  venusDataSet: Record<string, any> | null | undefined,
): VenusData | undefined => {
  if (!venusDataSet) {
    return undefined;
  }

  return {
    commandInfo: (venusDataSet.command_info_array ?? []).map((cmd: any) => ({
      commandId: cmd.command_id,
      commandType: cmd.command_type,
      params: (cmd.params_inc_dec_info_array ?? []).map((param: any) => ({
        targetType: param.target_type,
        value: param.value,
      })),
    })),
    evaluationInfo: (venusDataSet.evaluation_info_array ?? []).map(
      (item: any) => ({
        targetId: item.target_id,
        trainingPartnerId: item.training_partner_id,
        evaluation: item.evaluation,
        charaId: item.chara_id,
        memberState: item.member_state,
        isOuting: item.is_outing,
        storyStep: item.story_step,
        isAppear: item.is_appear,
        groupOutingInfo: (item.group_outing_info_array ?? []).map(
          (groupItem: any) => ({
            charaId: groupItem.chara_id,
            isOuting: groupItem.is_outing,
            storyStep: groupItem.story_step,
          }),
        ),
      }),
    ),
    spiritInfo: (venusDataSet.spirit_info_array ?? []).map((item: any) => ({
      spiritNum: item.spirit_num,
      spiritId: item.spirit_id,
      effectGroupId: item.effect_group_id,
    })),
    activeEffectInfo: (
      venusDataSet.venus_spirit_active_effect_info_array ?? []
    ).map((item: any) => ({
      charaId: item.chara_id,
      effectGroupId: item.effect_group_id,
      beginTurn: item.begin_turn,
      endTurn: item.end_turn,
    })),
    charaInfo: (venusDataSet.venus_chara_info_array ?? []).map((item: any) => ({
      charaId: item.chara_id,
      venusLevel: item.venus_level,
    })),
    charaCommandInfo: (venusDataSet.venus_chara_command_info_array ?? []).map(
      (item: any) => ({
        commandId: item.command_id,
        commandType: item.command_type,
        spiritId: item.spirit_id,
        isBoost: item.is_boost,
      }),
    ),
    liveItemId: venusDataSet.live_item_id ?? 0,
  };
};

const normalizeSingleModeData = (data: Record<string, any>) => {
  const common = data.single_mode_load_common;
  if (!common || typeof common !== 'object') {
    return data;
  }

  const normalized = { ...common } as Record<string, any>;
  const dataSetKey = Object.keys(data).find((key) => key.endsWith('_data_set'));
  if (dataSetKey && normalized[dataSetKey] == null) {
    normalized[dataSetKey] = data[dataSetKey];
  }
  const dataSetLoadKey = Object.keys(data).find((key) =>
    key.endsWith('_data_set_load'),
  );
  if (dataSetLoadKey && normalized[dataSetLoadKey] == null) {
    normalized[dataSetLoadKey] = data[dataSetLoadKey];
  }

  const venusDataSet = normalized.venus_data_set;
  if (venusDataSet && typeof venusDataSet === 'object') {
    if (Array.isArray(venusDataSet.race_start_info)) {
      venusDataSet.race_start_info = null;
    }
    if (Array.isArray(venusDataSet.venus_race_condition)) {
      venusDataSet.venus_race_condition = null;
    }
  }

  return normalized;
};

const fetchStoryDetail = (storyId: number): Promise<StoryDetail | null> => {
  const cached = storyDetailCache.get(storyId);
  if (cached) {
    return Promise.resolve(cached);
  }
  const inflight = storyDetailInFlight.get(storyId);
  if (inflight) {
    return inflight;
  }

  const request = new Promise<StoryDetail | null>((resolve) => {
    const url = `https://le3-api.game.bilibili.com/x/api/umav1/story/detail?story_id=${storyId}`;
    https
      .get(
        url,
        {
          headers: {
            'User-Agent':
              'Dalvik/2.1.0 (Linux; U; Android 12; 22041216C Build/688207e.0)',
            Connection: 'Keep-Alive',
            'Accept-Encoding': 'gzip',
          },
        },
        (res) => {
          if (res.statusCode !== 200) {
            res.resume();
            resolve(null);
            return;
          }

          const chunks: Buffer[] = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => {
            const buffer = Buffer.concat(chunks);
            const encoding = res.headers['content-encoding'];
            const handleBody = (body: Buffer) => {
              try {
                const parsed = JSON.parse(body.toString('utf-8'));
                const optionList = parsed?.data?.option_list;
                if (!Array.isArray(optionList)) {
                  resolve(null);
                  return;
                }
                const detail: StoryDetail = {
                  storyId,
                  optionList: optionList
                    .map((opt: any) => ({
                      option: String(opt?.option ?? ''),
                      gainList: Array.isArray(opt?.gain_list)
                        ? opt.gain_list.map((gain: any) => String(gain))
                        : [],
                    }))
                    .filter(
                      (opt: any) => opt.option || opt.gainList.length > 0,
                    ),
                };
                storyDetailCache.set(storyId, detail);
                resolve(detail);
              } catch (err) {
                log.warn('story detail parse failed:', err);
                resolve(null);
              }
            };

            if (encoding === 'gzip') {
              zlib.gunzip(buffer, (err, decoded) => {
                if (err) {
                  resolve(null);
                  return;
                }
                handleBody(decoded);
              });
            } else {
              handleBody(buffer);
            }
          });
        },
      )
      .on('error', (err) => {
        log.warn('story detail request failed:', err);
        resolve(null);
      });
  }).finally(() => {
    storyDetailInFlight.delete(storyId);
  });

  storyDetailInFlight.set(storyId, request);
  return request;
};

// eslint-disable-next-line import/prefer-default-export
export async function extractCoreInfo(
  decodedData: unknown,
  _mainWindow: BrowserWindow,
) {
  if (!isUMASingleModelResponse(decodedData)) {
    return;
  }
  const decoded = decodedData;
  const normalizedData = normalizeSingleModeData(
    decoded.data as Record<string, any>,
  );
  const chara = normalizedData.chara_info;
  if (!chara) return;
  const scenarioType = resolveScenarioType(
    normalizedData as Record<string, unknown>,
  );
  const home = normalizedData.home_info;
  const stats: CharStats = {
    speed: { value: chara.speed, max: chara.max_speed },
    stamina: { value: chara.stamina, max: chara.max_stamina },
    power: { value: chara.power, max: chara.max_power },
    wiz: { value: chara.wiz, max: chara.max_wiz },
    guts: { value: chara.guts, max: chara.max_guts },
    vital: { value: chara.vital, max: chara.max_vital },
    skillPoint: chara.skill_point,
  };
  const freeData = normalizedData.free_data_set;
  const liveData = normalizedData.live_data_set;
  const venusData = extractVenusData(normalizedData.venus_data_set);
  const charaEffects: CharaEffect[] = (chara.chara_effect_id_array ?? [])
    .filter((id: unknown): id is number => typeof id === 'number')
    .map((id: number) => ({
      id,
      text: UMDB.charaEffectTexts[id] ?? `状态 ${id}`,
    }));
  const effectedLiveIds = Array.from(
    new Set(
      (liveData?.effected_live_id_array ?? [])
        .map((id) => COMMAND_TO_MASTER_BONUS[id] ?? id)
        .filter((id): id is number => typeof id === 'number'),
    ),
  );
  log.info('effectedLiveIds:', effectedLiveIds);
  const specialtyEffectIds = new Set(
    (liveData?.effected_live_id_array ?? []).filter((id) =>
      SPECIALTY_RATE_PLUS_FIVE_EFFECT_IDS.includes(id),
    ),
  );
  const specialtyLiveEffectCount = specialtyEffectIds.size;
  const homeCommandInfoArray = home?.command_info_array ?? [];
  const allTrainingPartners = homeCommandInfoArray.flatMap(
    (cmd) => cmd.training_partner_array || [],
  );
  const gameStats: GameStats = {
    turn: chara.turn,
    coinNum: freeData?.coin_num ?? 0,
    motivation: chara.motivation,
    startTime: chara.start_time,
    liveMasterIds: liveData?.master_live_id_array ?? [],
    nextLiveIds: liveData?.next_live_id_array ?? [],
    effectedLiveIds,
    specialtyLiveEffectCount,
    specialtyLiveEffectRate: specialtyLiveEffectCount * 5,
    currentTrainingPartnerCount: allTrainingPartners.length,
    currentTrainingPartnerUniqueCount: new Set(allTrainingPartners).size,
  };
  const livePerf = liveData?.live_performance_info;
  const noteStat: NoteStat | undefined = livePerf
    ? {
        da: { value: livePerf.dance, max: livePerf.max_dance },
        pa: { value: livePerf.passion, max: livePerf.max_passion },
        vo: { value: livePerf.vocal, max: livePerf.max_vocal },
        vi: { value: livePerf.visual, max: livePerf.max_visual },
        me: { value: livePerf.mental, max: livePerf.max_mental },
      }
    : undefined;

  const songStats: SongStat[] | undefined = liveData?.next_square_info_array
    ?.map((square) => {
      const song = UMDB.liveSongs[square.square_id];
      if (!song) {
        return undefined;
      }
      const notes = { da: 0, pa: 0, vo: 0, vi: 0, me: 0 };
      song.perfType.forEach((type, idx) => {
        const rawValue = song.perfValue[idx] ?? 0;
        const key = PERF_TYPE_TO_NOTE_KEY[type];
        if (key) {
          notes[key] = rawValue;
        }
      });
      const rawContent = song.squareContent ?? '无';
      const normalized = rawContent.replace(/\\n/g, ' | '); // Windows → Unix
      const contentLabel = '';
      const attributes = [
        {
          label: contentLabel,
          value: formatColorHtml(normalized),
          tone: 'neutral' as const,
        },
        {
          label: '',
          value: song.liveShowContext ?? '无',
          tone: 'neutral' as const,
        },
      ];
      return {
        id: song.id ?? square.square_id,
        title: song.squareTitle ?? `Song ${square.square_id}`,
        tag: '歌曲',
        attributes,
        notes,
      };
    })
    .filter(Boolean) as SongStat[] | undefined;

  // ---------- command Stats ----------
  const commands = homeCommandInfoArray.map((cmd) => ({
    commandId: cmd.command_id,
    commandType: cmd.command_type,
    isEnable: cmd.is_enable,
    failureRate: cmd.failure_rate,
    level: cmd.level,
    trainingPartners: cmd.training_partner_array || [],
    tipsPartners: cmd.tips_event_partner_array || [],
    params: (cmd.params_inc_dec_info_array || []).map((p) => ({
      targetType: p.target_type,
      value: p.value,
    })),
  }));
  // ---------- live add Stats ----------
  const liveCommands = (liveData?.command_info_array ?? []).map((cmd) => ({
    commandId: cmd.command_id,
    commandType: cmd.command_type,
    performance: (cmd.performance_inc_dec_info_array || []).map((p) => ({
      performanceType: p.performance_type,
      value: p.value,
    })),
    params: (cmd.params_inc_dec_info_array || []).map((p: any) => ({
      targetType: p.target_type,
      value: p.value,
    })),
  }));
  const livePurchasedIds = Array.from(
    new Set(
      (liveData?.master_live_id_array ?? [])
        .map((id) => COMMAND_TO_MASTER_BONUS[id])
        .filter((id): id is number => typeof id === 'number'),
    ),
  );

  // ---------- partner Stats ----------
  const supportCards = chara.support_card_array || [];
  const evaluations = chara.evaluation_info_array || [];

  const partnerStats = evaluations.map((evalEntry) => {
    const position = evalEntry.training_partner_id;
    const matchedCard = supportCards.find((card) => card.position === position);
    const result = {
      position,
      evaluation: evalEntry.evaluation ?? 0,
      supportCardId: 0,
      charaPath: '',
      limitBreak: 0,
      exp: 0,
    };
    if (matchedCard) {
      result.supportCardId = matchedCard.support_card_id;
      const supportCard = UMDB.supportCards[matchedCard.support_card_id];
      result.charaPath = supportCard
        ? (UMDB.charas[supportCard.charaId!]?.iconUrl ?? '')
        : '';
      result.limitBreak = matchedCard.limit_break_count;
      result.exp = matchedCard.exp;
    }
    if (position >= 1000) {
      result.charaPath = UMDB.charas[position]?.iconUrl ?? '';
    }
    return result;
  });

  const rawEvents = normalizedData?.unchecked_event_array || [];
  const gameEvents = rawEvents.flatMap((ev: any) => {
    const storyId = ev.story_id;
    const choiceArray = ev.event_contents_info?.choice_array || [];

    log.info('story_id:', storyId);
    log.info('choice_array:');
    choiceArray.forEach((choice: any) => {
      log.info('  -', choice);
    });
    const rule = resolveEventRule(storyId);
    const options = choiceArray.map((choice: any, position: number) => {
      const idx = choice.select_index;
      const matched = rule?.options?.[position]?.[idx];
      return (
        matched ?? {
          desp: `选项结果id: ${choice.select_index}`,
          detail: '相同选项id的具体效果相同，可以通过多次触发事件进行确认。',
          type: 'unknown',
        }
      );
    });

    return [
      {
        eventId: storyId,
        eventName: rule?.name ?? `事件 ${storyId}`,
        options,
      },
    ];
  });
  const uniqueStoryIds = Array.from(
    new Set(gameEvents.map((event) => event.eventId)),
  );
  const detailResults = await Promise.all(
    uniqueStoryIds.map((storyId) => fetchStoryDetail(storyId)),
  );
  const eventDetails: Record<number, StoryDetail> = {};
  detailResults.forEach((detail) => {
    if (detail) {
      eventDetails[detail.storyId] = detail;
    }
  });
  _mainWindow.webContents.send('core-info-update', {
    scenarioType,
    gameStats,
    stats,
    charaEffects,
    commands,
    liveCommands: scenarioType === 'idolCup' ? liveCommands : undefined,
    livePurchasedIds: scenarioType === 'idolCup' ? livePurchasedIds : undefined,
    partnerStats,
    gameEvents,
    eventDetails,
    venusData: scenarioType === 'venusCup' ? venusData : undefined,
    noteStat: scenarioType === 'idolCup' ? noteStat : undefined,
    songStats: scenarioType === 'idolCup' ? songStats : undefined,
  });
}
