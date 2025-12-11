import log from 'electron-log';
import { resolveEventRule } from 'constant/events';
import { BrowserWindow } from 'electron';
import { CharStats, GameStats } from 'types/gameTypes';
import { isUMASingleModelResponse } from 'types/ingame/UMASingleModelResponse';
import { UMDB } from './Data';

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
  const gameStats: GameStats = {
    turn: chara.turn,
  };

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
    if (!rule) {
      return [];
    }
    const options = choiceArray.map((choice: any, position: number) => {
      const idx = choice.select_index;
      const group = rule.options?.[position];
      const matched = group?.[idx];

      return (
        matched ?? {
          desp: 'unknown',
          detail: '',
          type: 'unknown',
        }
      );
    });

    return [
      {
        eventId: storyId,
        eventName: rule.name,
        options,
      },
    ];
  });
  _mainWindow.webContents.send('core-info-update', {
    gameStats,
    stats,
    commands,
    partnerStats,
    gameEvents,
  });
}
