import {
  mergeStoredSuccessionPlayers,
  normalizeImportedSuccessionPlayers,
  StoredSuccessionPlayer,
} from './SuccessionPlayerScan';

function player(
  viewerId: string,
  fetchedAt = '2026-08-18T12:00:00.000Z',
): StoredSuccessionPlayer {
  return {
    viewerId,
    name: `玩家 ${viewerId}`,
    fetchedAt,
    userInfo: { viewer_id: Number(viewerId) },
    practicePartner: { card_id: 100101 },
  };
}

describe('normalizeImportedSuccessionPlayers', () => {
  test('accepts the exported players object', () => {
    expect(
      normalizeImportedSuccessionPlayers({
        version: 1,
        players: [player('245749415802')],
      }),
    ).toEqual([player('245749415802')]);
  });

  test('accepts a direct array and fills optional metadata', () => {
    const [result] = normalizeImportedSuccessionPlayers([
      {
        userInfo: { viewer_id: 426751416382, name: '测试玩家' },
        practicePartner: { card_id: 100201 },
      },
    ]);

    expect(result).toMatchObject({
      viewerId: '426751416382',
      name: '测试玩家',
      userInfo: { viewer_id: 426751416382, name: '测试玩家' },
      practicePartner: { card_id: 100201 },
    });
    expect(Number.isNaN(Date.parse(result.fetchedAt))).toBe(false);
  });

  test('deduplicates players by viewer id and keeps the last record', () => {
    const results = normalizeImportedSuccessionPlayers([
      player('196682775987', '2026-08-18T12:00:00.000Z'),
      {
        ...player('196682775987', '2026-08-19T12:00:00.000Z'),
        name: '更新后的玩家',
      },
    ]);

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('更新后的玩家');
  });

  test('rejects invalid file shapes', () => {
    expect(() => normalizeImportedSuccessionPlayers({ data: [] })).toThrow(
      '导入文件不是有效的种马数据',
    );
  });

  test('rejects records without an object practice partner', () => {
    expect(() =>
      normalizeImportedSuccessionPlayers([
        { viewerId: '690824365531', practicePartner: 'invalid' },
      ]),
    ).toThrow('导入文件中没有可识别的种马记录');
  });
});

describe('mergeStoredSuccessionPlayers', () => {
  test('merges imported players without removing existing players', () => {
    const existing = player('245749415802');
    const imported = player('426751416382', '2026-08-19T12:00:00.000Z');

    expect(mergeStoredSuccessionPlayers([existing], [imported])).toEqual([
      imported,
      existing,
    ]);
  });
});
