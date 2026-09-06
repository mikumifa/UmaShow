import { spawn } from 'child_process';
import path from 'path';
import type { BrowserWindow } from 'electron';
import {
  buildMonteCarloState,
  captureMonteCarloPacket,
  getLatestMonteCarloState,
} from './MonteCarloState';

const supportCardIds = [30188, 30186, 30187, 30189, 30190, 30185];

const makePacket = ({
  runId,
  turn = 10,
  commandResult,
  uncheckedEvents = [],
  trainingLevels = [2, 3, 1, 4, 5],
  friendOuting = 1,
  friendStoryStep = 2,
}: {
  runId: number;
  turn?: number;
  commandResult?: Record<string, unknown>;
  uncheckedEvents?: unknown[];
  trainingLevels?: number[];
  friendOuting?: number;
  friendStoryStep?: number;
}) => ({
  response_code: 1,
  data: {
    chara_info: {
      single_mode_chara_id: runId,
      start_time: `run-${runId}`,
      card_id: 100101,
      rarity: 5,
      scenario_id: 9,
      playing_state: 1,
      turn,
      vital: 72,
      max_vital: 104,
      motivation: 4,
      speed: 1300,
      stamina: 900,
      power: 800,
      guts: 700,
      wiz: 600,
      max_speed: 1750,
      max_stamina: 1700,
      max_power: 1500,
      max_guts: 1300,
      max_wiz: 1300,
      skill_point: 321,
      chara_effect_id_array: [6, 7, 8, 25, 32],
      support_card_array: supportCardIds.map((supportCardId, index) => ({
        position: index + 1,
        support_card_id: supportCardId,
        limit_break_count: 4,
      })),
      evaluation_info_array: [
        ...supportCardIds.map((_, index) => ({
          target_id: index + 1,
          evaluation: 30 + index * 10,
          is_outing: index === 0 ? friendOuting : 0,
          story_step: index === 0 ? friendStoryStep : 0,
        })),
        { target_id: 102, evaluation: 40 },
        { target_id: 103, evaluation: 55 },
      ],
      training_level_info_array: [901, 105, 902, 103, 906].map(
        (commandId, index) => ({
          command_id: commandId,
          level: trainingLevels[index],
        }),
      ),
    },
    home_info: {
      command_info_array: [
        {
          command_id: 901,
          is_enable: 1,
          training_partner_array: [1, 102, 1001],
          tips_event_partner_array: [2],
        },
        {
          command_id: 105,
          is_enable: 1,
          training_partner_array: [2],
          tips_event_partner_array: [],
        },
        {
          command_id: 902,
          is_enable: 1,
          training_partner_array: [3],
          tips_event_partner_array: [],
        },
        {
          command_id: 103,
          is_enable: 1,
          training_partner_array: [4],
          tips_event_partner_array: [],
        },
        {
          command_id: 906,
          is_enable: 1,
          training_partner_array: [5],
          tips_event_partner_array: [],
        },
      ],
    },
    unchecked_event_array: uncheckedEvents,
    command_result: commandResult,
    mecha_data_set: {
      tuning_point: 7,
      rival_info: {
        speed: 11,
        stamina: 12,
        power: 13,
        guts: 14,
        wiz: 15,
      },
      overdrive_info: {
        remain_num: 1,
        energy_num: 2,
        over_drive_state: 1,
        is_overdrive_burst: 0,
      },
      board_info_array: [
        {
          board_id: 3,
          chip_info_array: [
            { chip_id: 1001, point: 7 },
            { chip_id: 1003, point: 8 },
            { chip_id: 1009, point: 9 },
            { chip_id: 2003, point: 6 },
          ],
        },
        {
          board_id: 1,
          chip_info_array: [
            { chip_id: 1005, point: 1 },
            { chip_id: 1006, point: 2 },
            { chip_id: 1007, point: 3 },
            { chip_id: 2001, point: 4 },
          ],
        },
        {
          board_id: 2,
          chip_info_array: [
            { chip_id: 1002, point: 4 },
            { chip_id: 1004, point: 5 },
            { chip_id: 1008, point: 6 },
            { chip_id: 2002, point: 5 },
          ],
        },
      ],
      command_info_array: [
        { command_id: 906, is_recommend: true },
        { command_id: 902, is_recommend: false },
        { command_id: 901, is_recommend: true },
        { command_id: 103, is_recommend: false },
        { command_id: 105, is_recommend: true },
      ],
      upgrade_race_result_array: [
        { schedule_id: 1, result_type: 3 },
        { schedule_id: 3, result_type: 2 },
      ],
    },
  },
});

const larcSupportCardIds = [30028, 30186, 30160, 30187, 30189, 30190];
const larcSupportTargets = [
  { target_id: 1, chara_id: 1201 },
  { target_id: 2, chara_id: 1202 },
  { target_id: 4, chara_id: 1204 },
  { target_id: 5, chara_id: 1205 },
  { target_id: 6, chara_id: 1206 },
];
const larcNpcTargets = Array.from({ length: 10 }, (_, index) => ({
  target_id: 1001 + index,
  chara_id: 1001 + index,
}));
const larcArcTargets = [...larcSupportTargets, ...larcNpcTargets];

const makeLArcPacket = ({
  runId,
  turn = 10,
  uncheckedEvents = [],
  isSpecial = 1,
}: {
  runId: number;
  turn?: number;
  uncheckedEvents?: unknown[];
  isSpecial?: number;
}) => {
  const trainIds = [101, 105, 102, 103, 106];
  return {
    response_code: 1,
    data: {
      chara_info: {
        single_mode_chara_id: runId,
        start_time: `larc-${runId}`,
        card_id: 100101,
        rarity: 5,
        scenario_id: 6,
        playing_state: 1,
        turn,
        vital: 72,
        max_vital: 104,
        motivation: 4,
        speed: 1300,
        stamina: 900,
        power: 800,
        guts: 700,
        wiz: 600,
        max_speed: 1600,
        max_stamina: 1600,
        max_power: 1500,
        max_guts: 1500,
        max_wiz: 1300,
        skill_point: 321,
        chara_effect_id_array: [6, 7, 8, 25],
        support_card_array: larcSupportCardIds.map((supportCardId, index) => ({
          position: index + 1,
          support_card_id: supportCardId,
          limit_break_count: 4,
        })),
        evaluation_info_array: [
          ...larcSupportCardIds.map((_, index) => ({
            target_id: index + 1,
            evaluation: 35 + index * 8,
            is_outing: index === 2 ? 1 : 0,
            story_step: index === 2 ? 2 : 0,
          })),
          ...larcNpcTargets.map((target, index) => ({
            target_id: target.target_id,
            evaluation: 20 + index,
          })),
          { target_id: 102, evaluation: 40 },
          { target_id: 103, evaluation: 55 },
        ],
        training_level_info_array: trainIds.map((commandId, index) => ({
          command_id: commandId,
          level: index + 1,
        })),
      },
      home_info: {
        command_info_array: trainIds.map((commandId, index) => ({
          command_id: commandId,
          is_enable: 1,
          failure_rate: index,
          training_partner_array:
            index === 0 ? [1, 3, 1001] : [larcNpcTargets[index + 1].target_id],
          tips_event_partner_array: index === 0 ? [2] : [],
          params_inc_dec_info_array: [
            { target_type: index + 1, value: 5 + index },
            { target_type: 30, value: 4 + index },
            { target_type: 10, value: index === 4 ? 5 : -20 },
          ],
        })),
      },
      unchecked_event_array: uncheckedEvents,
      race_start_info: null,
      arc_data_set: {
        arc_info: {
          global_exp: 240,
          potential_array: [2, 5, 1, 4, 6, 3, 7, 8, 9, 10].map(
            (potentialId, index) => ({
              potential_id: potentialId,
              level: (index % 3) + 1,
            }),
          ),
        },
        evaluation_info_array: [
          ...larcSupportTargets,
          { target_id: 3, chara_id: 1094 },
          ...larcNpcTargets,
        ],
        arc_rival_array: larcArcTargets.map((target, index) => ({
          chara_id: target.chara_id,
          command_id: trainIds[index % 5],
          rival_boost: index % 4,
          star_lv: index % 3,
          approval_point: 100 + index,
          selection_peff_array: [
            { effect_num: 1, effect_group_id: 1 },
            { effect_num: 2, effect_group_id: 11 },
            { effect_num: 3, effect_group_id: index === 6 ? 8 : 7 },
          ],
        })),
        selection_info: {
          is_special_match: isSpecial,
          selection_rival_info_array: [
            { chara_id: 1201, mark: 1 },
            { chara_id: 1001, mark: 1 },
          ],
        },
        command_info_array: trainIds.map((commandId, index) => ({
          command_id: commandId,
          params_inc_dec_info_array: [
            { target_type: index + 1, value: 3 },
            { target_type: 30, value: 2 },
          ],
        })),
      },
    },
  };
};

describe('MonteCarloState', () => {
  it('converts a captured Mecha response into the UmaAi protocol state', () => {
    const state = buildMonteCarloState(makePacket({ runId: 91001 }));

    expect(state).not.toBeNull();
    expect(state).toMatchObject({
      umaId: 100101,
      umaStar: 5,
      turn: 9,
      gameStage: 1,
      fiveStatus: [1400, 900, 800, 700, 600],
      fiveStatusLimit: [2300, 2200, 1800, 1400, 1400],
      skillPt: 321,
      trainLevelCount: [4, 8, 0, 12, 16],
      failureRateBias: 2,
      isQieZhe: true,
      isAiJiao: true,
      isPositiveThinking: true,
      isRefreshMind: true,
      zhongMaBlueCount: [0, 0, 0, 0, 0],
      cardId: [301884, 301864, 301874, 301894, 301904, 301854],
      personDistribution: [
        [0, 6, 8, -1, -1],
        [1, -1, -1, -1, -1],
        [2, -1, -1, -1, -1],
        [3, -1, -1, -1, -1],
        [4, -1, -1, -1, -1],
      ],
      friendship_noncard_yayoi: 40,
      friendship_noncard_reporter: 55,
      friend_stage: 2,
      friend_outgoingUsed: 2,
      mecha_rivalLv: [11, 12, 13, 14, 15],
      mecha_overdrive_energy: 5,
      mecha_overdrive_enabled: true,
      mecha_EN: 22,
      mecha_upgrade: [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ],
      mecha_hasGear: [true, true, false, false, true],
      mecha_win_history: [2, 0, 1, 0, 0],
    });
    expect((state?.persons as Array<{ isHint: boolean }>)[1].isHint).toBe(true);
  });

  it('tracks a successful friend-card training without using a state file', () => {
    const runId = 91002;
    buildMonteCarloState(
      makePacket({
        runId,
        trainingLevels: [1, 1, 1, 1, 1],
        friendOuting: 0,
        friendStoryStep: 0,
      }),
    );

    const send = jest.fn();
    const mainWindow = {
      isDestroyed: () => false,
      webContents: { isDestroyed: () => false, send },
    } as unknown as BrowserWindow;
    captureMonteCarloPacket(
      { current_turn: 10, command_id: 901 },
      'request',
      mainWindow,
    );
    captureMonteCarloPacket(
      makePacket({
        runId,
        turn: 11,
        commandResult: { command_id: 901, result_state: 0 },
        trainingLevels: [1, 1, 1, 1, 1],
        friendOuting: 0,
        friendStoryStep: 0,
      }),
      'response',
      mainWindow,
    );

    expect(getLatestMonteCarloState()?.state).toMatchObject({
      trainLevelCount: [1, 0, 0, 0, 0],
      friend_stage: 1,
      friend_outgoingUsed: 0,
    });
    expect(send).toHaveBeenCalledWith(
      'monte-carlo:state-captured',
      expect.objectContaining({ turn: 10, gameStage: 1 }),
    );
  });

  it('does not recommend while an event is waiting for user input', () => {
    expect(
      buildMonteCarloState(
        makePacket({ runId: 91003, uncheckedEvents: [{ event_id: 1 }] }),
      ),
    ).toBeNull();
  });

  it('converts a captured LArc response into the UmaAi LArc protocol', () => {
    const state = buildMonteCarloState(makeLArcPacket({ runId: 92001 }));

    expect(state).not.toBeNull();
    expect(state).toMatchObject({
      scenarioId: 6,
      umaId: 5100101,
      turn: 9,
      fiveStatus: [1400, 900, 800, 700, 600],
      fiveStatusLimit: [2000, 2000, 1800, 1800, 1400],
      normalCardCount: 5,
      cardId: [300284, 301864, 301604, 301874, 301894, 301904],
      trainLevelCount: [0, 4, 8, 12, 16],
      larc_supportPtAll: 1605,
      larc_shixingPt: 240,
      larc_levels: [1, 2, 3, 1, 2, 3, 1, 2, 3, 1],
      larc_isSSS: true,
      larc_ssWin: 15,
      larc_zuoyueOutgoingUnlocked: true,
      larc_zuoyueOutgoingUsed: 2,
      larc_ssPersonsCount: 2,
      larc_ssPersons: [0, 5, -1, -1, -1],
      personDistribution: [
        [0, 17, 5, -1, -1],
        [7, -1, -1, -1, -1],
        [8, -1, -1, -1, -1],
        [9, -1, -1, -1, -1],
        [10, -1, -1, -1, -1],
      ],
      trainValue: [
        [16, 0, 0, 0, 0, 6, -20],
        [0, 9, 0, 0, 0, 7, -20],
        [0, 0, 10, 0, 0, 8, -20],
        [0, 0, 0, 11, 0, 9, -20],
        [0, 0, 0, 0, 12, 10, 5],
      ],
      failRate: [0, 1, 2, 3, 4],
    });
    const persons = state?.persons as Array<Record<string, unknown>>;
    expect(persons[0]).toMatchObject({
      personType: 2,
      cardIdInGame: 0,
      larc_specialBuff: 7,
    });
    expect(persons[17]).toMatchObject({
      personType: 1,
      cardIdInGame: 2,
    });
    expect(persons[1].isHint).toBe(true);
  });

  it('accepts the LArc single_mode_start_common response shape', () => {
    const packet = makeLArcPacket({ runId: 92004 });
    const { arc_data_set: arcDataSet, ...common } = packet.data;
    expect(
      buildMonteCarloState({
        response_code: 1,
        data: {
          single_mode_start_common: common,
          arc_data_set: arcDataSet,
        },
      }),
    ).toMatchObject({ scenarioId: 6, turn: 9 });
  });

  it('tracks completed non-SSS matches from the LArc event stream', () => {
    const runId = 92002;
    buildMonteCarloState(makeLArcPacket({ runId, isSpecial: 0 }));
    expect(
      buildMonteCarloState(
        makeLArcPacket({
          runId,
          isSpecial: 0,
          uncheckedEvents: [{ story_id: 400006112 }],
        }),
      ),
    ).toBeNull();
    expect(
      buildMonteCarloState(makeLArcPacket({ runId, turn: 11, isSpecial: 0 })),
    ).toMatchObject({ larc_ssWinSinceLastSSS: 2 });
  });

  it('produces state accepted by UmaShowMonteCarlo.exe', async () => {
    if (process.platform !== 'win32') return;
    const state = buildMonteCarloState(makePacket({ runId: 91004 }));
    expect(state).not.toBeNull();

    const executable = path.join(
      process.cwd(),
      'assets',
      'native',
      'UmaShowMonteCarlo.exe',
    );
    const database = path.join(
      process.cwd(),
      'assets',
      'data',
      'monte_carlo.json',
    );
    const response = await new Promise<Record<string, unknown>>(
      (resolve, reject) => {
        const child = spawn(executable, [database], { windowsHide: true });
        const timer = setTimeout(() => {
          child.kill();
          reject(new Error('native smoke test timed out'));
        }, 20000);
        let output = '';
        child.stdout.setEncoding('utf8');
        child.stdout.on('data', (chunk: string) => {
          output += chunk;
          const lines = output.split(/\r?\n/);
          output = lines.pop() || '';
          lines.forEach((line) => {
            const marker = line.indexOf('UMASHOW_JSON:');
            if (marker < 0) return;
            const message = JSON.parse(
              line.slice(marker + 'UMASHOW_JSON:'.length),
            ) as Record<string, unknown>;
            if (message.type === 'ready') {
              child.stdin.write(
                `${JSON.stringify({
                  id: 'state-smoke',
                  state,
                  options: {
                    searchSingleMax: 16,
                    searchGroupSize: 16,
                    threadNum: 1,
                    maxDepth: 1,
                  },
                })}\n`,
              );
            } else if (message.id === 'state-smoke') {
              clearTimeout(timer);
              child.kill();
              resolve(message);
            }
          });
        });
        child.once('error', (error) => {
          clearTimeout(timer);
          reject(error);
        });
        child.once('exit', (code) => {
          if (code && code !== 0) {
            clearTimeout(timer);
            reject(new Error(`native process exited with code ${code}`));
          }
        });
      },
    );

    expect(response).toMatchObject({ ok: true, id: 'state-smoke' });
  }, 30000);

  it('produces state accepted by UmaShowMonteCarloLArc.exe', async () => {
    if (process.platform !== 'win32') return;
    const state = buildMonteCarloState(makeLArcPacket({ runId: 92003 }));
    expect(state).not.toBeNull();

    const executable = path.join(
      process.cwd(),
      'assets',
      'native',
      'UmaShowMonteCarloLArc.exe',
    );
    const database = path.join(
      process.cwd(),
      'assets',
      'data',
      'monte_carlo.json',
    );
    let diagnostic = '';
    const response = await new Promise<Record<string, unknown>>(
      (resolve, reject) => {
        const child = spawn(executable, [database], { windowsHide: true });
        const timer = setTimeout(() => {
          child.kill();
          reject(new Error('LArc native smoke test timed out'));
        }, 30000);
        let output = '';
        child.stdout.setEncoding('utf8');
        child.stdout.on('data', (chunk: string) => {
          output += chunk;
          const lines = output.split(/\r?\n/);
          output = lines.pop() || '';
          lines.forEach((line) => {
            const marker = line.indexOf('UMASHOW_JSON:');
            if (marker < 0) {
              diagnostic += `${line}\n`;
              return;
            }
            const message = JSON.parse(
              line.slice(marker + 'UMASHOW_JSON:'.length),
            ) as Record<string, unknown>;
            if (message.type === 'ready') {
              child.stdin.write(
                `${JSON.stringify({
                  id: 'larc-state-smoke',
                  state,
                  options: {
                    searchSingleMax: 1,
                    threadNum: 1,
                  },
                })}\n`,
              );
            } else if (message.id === 'larc-state-smoke') {
              clearTimeout(timer);
              child.kill();
              resolve(message);
            }
          });
        });
        child.once('error', (error) => {
          clearTimeout(timer);
          reject(error);
        });
        child.once('exit', (code) => {
          if (code && code !== 0) {
            clearTimeout(timer);
            reject(new Error(`LArc native process exited with code ${code}`));
          }
        });
      },
    );

    if (!response.ok)
      throw new Error(`${String(response.error)}\n${diagnostic}`);
    expect(response).toMatchObject({
      ok: true,
      id: 'larc-state-smoke',
      scenarioId: 6,
    });
  }, 40000);
});
