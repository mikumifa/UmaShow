import log from 'electron-log';
import { resolveEventRule } from 'constant/events';
import { COMMAND_TO_MASTER_BONUS } from 'constant/live/liveSchedule';
import { BrowserWindow } from 'electron';
import { CharStats, GameStats, NoteStat, SongStat } from 'types/gameTypes';
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

export function extractCoreInfo(
  decodedData: unknown,
  _mainWindow: BrowserWindow,
) {
  if (!isUMASingleModelResponse(decodedData)) {
    return;
  }
  const decoded = decodedData;
  const chara = decoded.data.chara_info;
  if (!chara) return;
  const home = decoded.data.home_info;
  const stats: CharStats = {
    speed: { value: chara.speed, max: chara.max_speed },
    stamina: { value: chara.stamina, max: chara.max_stamina },
    power: { value: chara.power, max: chara.max_power },
    wiz: { value: chara.wiz, max: chara.max_wiz },
    guts: { value: chara.guts, max: chara.max_guts },
    vital: { value: chara.vital, max: chara.max_vital },
    skillPoint: chara.skill_point,
  };
  const freeData = decoded.data.free_data_set;
  const gameStats: GameStats = {
    turn: chara.turn,
    coinNum: freeData?.coin_num ?? 0,
  };
  const liveData = decoded.data.live_data_set;
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
  const commands = (home?.command_info_array ?? []).map((cmd) => ({
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

  const rawEvents = decoded.data?.unchecked_event_array || [];
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
      return matched
        ? matched
        : {
            desp: `选项结果id: ${choice.select_index}`,
            detail: '相同选项id的具体效果相同，可以通过多次触发事件进行确认。',
            type: 'unknown',
          };
    });

    return [
      {
        eventId: storyId,
        eventName: rule ? rule.name : `事件 ${storyId}`,
        options,
      },
    ];
  });
  _mainWindow.webContents.send('core-info-update', {
    gameStats,
    stats,
    commands,
    liveCommands,
    livePurchasedIds,
    partnerStats,
    gameEvents,
    noteStat,
    songStats,
  });
}
