import {
  careerTurnFromResponse,
  parseSuccessionPlayerIds,
  SuccessionGameClient,
} from './SuccessionGameClient';

describe('parseSuccessionPlayerIds', () => {
  test('accepts pasted player ids separated by whitespace and punctuation', () => {
    expect(
      parseSuccessionPlayerIds(
        '245749415802\n426751416382, 196682775987；690824365531',
      ),
    ).toEqual(['245749415802', '426751416382', '196682775987', '690824365531']);
  });

  test('deduplicates ids and ignores invalid fragments', () => {
    expect(parseSuccessionPlayerIds('245749415802 x 123 245749415802')).toEqual(
      ['245749415802'],
    );
  });
});

describe('SuccessionGameClient career lifecycle', () => {
  test('extracts the current turn from scenario load containers', () => {
    expect(
      careerTurnFromResponse({
        data: { single_mode_arc_load_common: { chara_info: { turn: 37 } } },
      }),
    ).toBe(37);
  });

  test('loads through the scenario family and force-deletes through single_mode', async () => {
    const client = new SuccessionGameClient('uid', 'access-key');
    const call = jest
      .spyOn(client as any, 'call')
      .mockResolvedValueOnce({
        data: { single_mode_arc_load_common: { chara_info: { turn: 37 } } },
      })
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValueOnce({ data: {} });

    const result = await client.abandonCareer(6, 12);

    expect(call).toHaveBeenNthCalledWith(1, 'single_mode_arc/load');
    expect(call).toHaveBeenNthCalledWith(2, 'single_mode/finish', {
      is_force_delete: true,
      current_turn: 37,
      factor_lottery_id: 0,
    });
    expect(call).toHaveBeenNthCalledWith(3, 'load/index', { adid: '' });
    expect(result.careerDeleted).toBe(true);
  });

  test('rejects success while load/index still reports a career', async () => {
    const client = new SuccessionGameClient('uid', 'access-key');
    jest
      .spyOn(client as any, 'call')
      .mockResolvedValueOnce({ data: { chara_info: { turn: 5 } } })
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValueOnce({
        data: { single_mode_chara_light: { turn: 5 } },
      });

    await expect(client.abandonCareer(1, 1)).rejects.toThrow(
      '游戏服务器仍报告有进行中的育成',
    );
  });
});

describe('SuccessionGameClient.searchPlayer', () => {
  test('uses the friend_viewer_id field expected by friend/search', async () => {
    const client = new SuccessionGameClient('uid', 'access-key');
    const call = jest.spyOn(client as any, 'call').mockResolvedValue({
      data: {
        user_info_summary: { name: '测试玩家' },
        practice_partner_info: { card_id: 100101 },
      },
    });

    await client.searchPlayer('245749415802');

    expect(call).toHaveBeenCalledWith('friend/search', {
      friend_viewer_id: 245749415802,
    });
  });
});
