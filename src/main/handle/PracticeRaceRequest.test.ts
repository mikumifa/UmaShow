import {
  buildPracticeRaceStartPayload,
  enrichPracticeRaceHorses,
  getPracticeRaceSourceViewerId,
  getPracticeRaceSourceViewerIds,
} from './PracticeRaceRequest';

describe('buildPracticeRaceStartPayload', () => {
  test('reconstructs a practice request from saved RaceData fields', () => {
    const horses = [
      ...Array.from({ length: 6 }, (_, index) => ({
        viewer_id: 876724857032,
        trained_chara_id: 13835 + index,
        ...(index === 2
          ? {
              owner_viewer_id: 963118703694,
              owner_trained_chara_id: 25216,
            }
          : {}),
        running_style: index % 4 || 1,
        motivation: 5,
      })),
      { viewer_id: 0, trained_chara_id: 88, running_style: 2 },
      { viewer_id: 0, trained_chara_id: 93, running_style: 1 },
      { viewer_id: 0, trained_chara_id: 97, running_style: 3 },
    ];

    const payload = buildPracticeRaceStartPayload({
      raceMetaInfo: {
        race_instance_id: 514001,
        season: 2,
        weather: 1,
        ground_condition: 1,
        random_seed: 123,
        entry_num: -1,
      },
      horses,
    });

    expect(payload).toEqual({
      race_instance_id: 514001,
      season: 2,
      weather: 1,
      ground_condition: 1,
      race_time: 0,
      motivation: 5,
      entry_num: 9,
      entry_chara_array: Array.from({ length: 6 }, (_, index) => ({
        viewer_id: 876724857032,
        trained_chara_id: 13835 + index,
        running_style: index % 4 || 1,
        entry_id: index,
      })),
    });
    expect(getPracticeRaceSourceViewerId(payload)).toBe('876724857032');
  });

  test('keeps borrowed entries on the current viewer and local partner id', () => {
    const payload = buildPracticeRaceStartPayload({
      raceMetaInfo: {
        race_instance_id: 514001,
        season: 2,
        weather: 1,
        ground_condition: 1,
        random_seed: 123,
        entry_num: 9,
      },
      horses: [
        {
          viewer_id: 876724857032,
          trained_chara_id: 13913,
          owner_viewer_id: 963118703694,
          owner_trained_chara_id: 25216,
          running_style: 1,
          motivation: 5,
        },
      ],
    });

    expect(payload.entry_chara_array).toEqual([
      {
        viewer_id: 876724857032,
        trained_chara_id: 13913,
        running_style: 1,
        entry_id: 0,
      },
    ]);
  });

  test('supports practice RaceData containing more than six trained characters', () => {
    const payload = buildPracticeRaceStartPayload({
      raceMetaInfo: {
        race_instance_id: 514001,
        season: 2,
        weather: 1,
        ground_condition: 1,
        random_seed: 123,
        entry_num: -1,
      },
      horses: [
        ...Array.from({ length: 8 }, (_, index) => ({
          viewer_id: 876724857032,
          trained_chara_id: 13800 + index,
          running_style: 1,
          motivation: 5,
        })),
        {
          viewer_id: 0,
          trained_chara_id: 90,
          running_style: 3,
          motivation: 5,
        },
      ],
    });

    expect(payload.entry_num).toBe(9);
    expect(payload.entry_chara_array).toHaveLength(8);
  });

  test('preserves entries from multiple participating accounts', () => {
    const payload = buildPracticeRaceStartPayload({
      raceMetaInfo: {
        race_instance_id: 514001,
        season: 2,
        weather: 1,
        ground_condition: 1,
        random_seed: 123,
        entry_num: 2,
      },
      horses: [
        {
          viewer_id: 876724857032,
          trained_chara_id: 13835,
          running_style: 1,
          motivation: 5,
        },
        {
          viewer_id: 963118703694,
          trained_chara_id: 25216,
          running_style: 2,
          motivation: 5,
        },
      ],
    });

    expect(payload.entry_chara_array).toEqual([
      {
        viewer_id: 876724857032,
        trained_chara_id: 13835,
        running_style: 1,
        entry_id: 0,
      },
      {
        viewer_id: 963118703694,
        trained_chara_id: 25216,
        running_style: 2,
        entry_id: 1,
      },
    ]);
    expect(getPracticeRaceSourceViewerIds(payload)).toEqual([
      '876724857032',
      '963118703694',
    ]);
  });

  test('rejects records without playable trained characters', () => {
    expect(() =>
      buildPracticeRaceStartPayload({
        raceMetaInfo: {
          race_instance_id: 514001,
          season: 2,
          weather: 1,
          ground_condition: 1,
          random_seed: 123,
        },
        horses: [{ viewer_id: 0, trained_chara_id: 88, running_style: 2 }],
      }),
    ).toThrow('没有可用于练习的育成马娘');
  });
});

describe('enrichPracticeRaceHorses', () => {
  test('persists the owner mapping returned for borrowed characters', () => {
    const horses = enrichPracticeRaceHorses(
      [
        {
          viewer_id: 876724857032,
          trained_chara_id: 13913,
          owner_viewer_id: 963118703694,
        },
        {
          viewer_id: 876724857032,
          trained_chara_id: 13835,
          owner_viewer_id: 0,
        },
      ],
      {
        practice_partner_owner_info_array: [
          {
            partner_trained_chara_id: 13913,
            owner_viewer_id: 963118703694,
            owner_name: 'Flamez77',
            owner_trained_chara_id: 25216,
            friend_state: 1,
          },
        ],
      },
    );

    expect(horses[0]).toMatchObject({
      viewer_id: 876724857032,
      trained_chara_id: 13913,
      owner_viewer_id: 963118703694,
      owner_trained_chara_id: 25216,
      owner_name: 'Flamez77',
      friend_state: 1,
    });
    expect(horses[1]).toEqual({
      viewer_id: 876724857032,
      trained_chara_id: 13835,
      owner_viewer_id: 0,
    });
  });
});
