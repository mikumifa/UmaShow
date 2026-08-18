import {
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
