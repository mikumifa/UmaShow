import { buildLocalDashboard } from './AutoResearchLocalDashboard';

jest.mock('better-sqlite3', () => jest.fn(), { virtual: true });
jest.mock(
  'electron',
  () => ({ app: { isPackaged: false, getAppPath: () => process.cwd() } }),
  { virtual: true },
);

describe('buildLocalDashboard', () => {
  const options = {
    masterDatabasePath: '__missing_local_dashboard_master__.mdb',
    observedAt: '2026-09-04T00:00:00.000Z',
  };

  it('uses one local load/index packet for account options and an idle marker', () => {
    const dashboard = buildLocalDashboard(
      {
        tp_info: { current_tp: 23, max_tp: 100 },
        coin_info: { fcoin: 120, coin: 80 },
        item_list: [
          { item_id: 32, number: 3 },
          { item_id: 59, number: 8000 },
          { item_id: 95, number: 2 },
        ],
        common_define: { single_mode_trained_chara_rental_max_num: 10 },
        single_mode_rental_succession_num: 4,
        card_list: [{ card_id: 100101, rarity: 3, talent_level: 5 }],
        support_card_list: [
          { support_card_id: 10001, exp: 40510, limit_break_count: 4 },
        ],
        support_card_deck_array: [
          { deck_id: 1, name: '测试卡组', support_card_id_array: [10001] },
        ],
        trained_chara: [
          {
            trained_chara_id: 77,
            card_id: 100101,
            rarity: 3,
            factor_info_array: [{ factor_id: 101 }],
            factor_extend_array: [
              { position_id: 1, base_factor_id: 101, factor_id: 103 },
            ],
            succession_chara_array: [
              {
                position_id: 10,
                card_id: 100201,
                rarity: 3,
                factor_info_array: [{ factor_id: 202 }],
              },
            ],
          },
        ],
        succession_trained_chara_data: {
          summary_user_info_array: [{ viewer_id: 9, name: '租借好友' }],
          succession_trained_chara_array: [
            {
              viewer_id: 9,
              trained_chara_id: 88,
              card_id: 100201,
              rarity: 3,
            },
          ],
        },
        friend_support_card_data: {
          summary_user_info_array: [
            {
              viewer_id: 12,
              name: '好友',
              support_card_id: 20001,
              user_support_card: { exp: 10, limit_break_count: 4 },
            },
          ],
        },
        single_mode_chara_light: {
          card_id: 100101,
          turn: 8,
          scenario_id: 1,
          vital: 70,
          max_vital: 100,
        },
        idle_single_mode_load_info: {
          playing_state: 1,
          start_time: '2026-09-04 00:00:00',
          end_time: '2026-09-04 01:00:00',
          single_mode_chara_light: { card_id: 100101, scenario_id: 7 },
        },
      },
      options,
    );

    expect(dashboard.account).toMatchObject({
      tp: { current: 23, max: 100 },
      carrots: { total: 200 },
      gold: 8000,
      clocks: 2,
      energy_drinks: 3,
      rental_succession: { known: true, used: 4, max: 10, remaining: 6 },
      career: null,
      idle_single_mode: {
        detected: true,
        active: true,
        state: 'playing',
        card_id: 100101,
        observed_at: options.observedAt,
      },
    });
    expect(dashboard.umas).toHaveLength(1);
    expect(dashboard.supports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 10001, owned: true, exp: 40510 }),
        expect.objectContaining({ id: 20001, owned: false }),
      ]),
    );
    expect(dashboard.decks[0]).toMatchObject({
      id: 1,
      support_card_ids: [10001],
    });
    expect(dashboard.parents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          selection_id: 'own:0:77',
          factors: [expect.objectContaining({ id: 103 })],
          ancestors: [
            expect.objectContaining({ position_id: 10, card_id: 100201 }),
          ],
        }),
        expect.objectContaining({
          selection_id: 'rental:9:88',
          owner_name: '租借好友',
        }),
      ]),
    );
    expect(dashboard.friends).toEqual([
      expect.objectContaining({ viewer_id: 12, support_card_id: 20001 }),
    ]);
    expect(dashboard.friend_exclude_ids).toEqual([12]);
  });

  it('reports an ordinary career only when no offline career occupies the account', () => {
    const dashboard = buildLocalDashboard(
      {
        single_mode_chara_light: {
          card_id: 100101,
          turn: 8,
          scenario_id: 1,
          vital: 70,
          max_vital: 100,
          succession_trained_chara_id_1: 1,
          succession_trained_chara_id_2: 2,
          support_card_array: [
            { position: 1, support_card_id: 10001 },
            {
              position: 6,
              support_card_id: 20001,
              owner_viewer_id: 123,
            },
          ],
        },
      },
      options,
    );

    expect(dashboard.account.idle_single_mode).toMatchObject({
      detected: false,
      active: false,
      state: 'none',
    });
    expect(dashboard.account.career).toMatchObject({
      active: true,
      card_id: 100101,
      turn: 8,
      support_card_ids: [10001],
      friend_viewer_id: 123,
      friend_card_id: 20001,
      parent_id_1: 1,
      parent_id_2: 2,
    });
  });
});
