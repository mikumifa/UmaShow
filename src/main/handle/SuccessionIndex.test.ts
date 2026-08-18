import {
  captureSuccessionIndex,
  resetSuccessionIndexForTests,
} from './SuccessionIndex';

describe('captureSuccessionIndex', () => {
  beforeEach(() => resetSuccessionIndexForTests());

  test('recognizes a nested load/index response and emits a trimmed snapshot', () => {
    const send = jest.fn();
    const mainWindow = { webContents: { send } } as any;
    const indexData = {
      card_list: [],
      trained_chara: [
        {
          trained_chara_id: 1,
          card_id: 100101,
          factor_info_array: [{ factor_id: 3203 }],
        },
      ],
      succession_trained_chara_data: {
        succession_trained_chara_array: [],
      },
      unrelated_large_field: { ignored: true },
    };

    expect(
      captureSuccessionIndex(
        { response_code: 1, data: { data: indexData } },
        mainWindow,
      ),
    ).toBe(true);
    expect(send).toHaveBeenCalledWith(
      'succession-index:update',
      expect.objectContaining({
        data: {
          trained_chara: indexData.trained_chara,
          trained_chara_array: undefined,
          succession_trained_chara_data:
            indexData.succession_trained_chara_data,
        },
      }),
    );
  });

  test('ignores ordinary race packets containing trained_chara_array', () => {
    const mainWindow = { webContents: { send: jest.fn() } } as any;
    expect(
      captureSuccessionIndex(
        {
          data: {
            opponent_info: { trained_chara_array: [{ card_id: 100101 }] },
          },
        },
        mainWindow,
      ),
    ).toBe(false);
  });

  test('merges a later pre_single_mode rental response into load/index data', () => {
    const send = jest.fn();
    const mainWindow = { webContents: { send } } as any;
    const ownRows = [
      {
        trained_chara_id: 1,
        factor_info_array: [{ factor_id: 402 }],
      },
    ];
    const rentalData = {
      summary_user_info_array: [{ viewer_id: 9, name: '好友' }],
      succession_trained_chara_array: [
        {
          viewer_id: 9,
          trained_chara_id: 2,
          factor_info_array: [{ factor_id: 2202 }],
        },
      ],
    };

    expect(
      captureSuccessionIndex({ data: { trained_chara: ownRows } }, mainWindow),
    ).toBe(true);
    expect(
      captureSuccessionIndex(
        { data: { succession_trained_chara_data: rentalData } },
        mainWindow,
      ),
    ).toBe(true);
    expect(send).toHaveBeenLastCalledWith(
      'succession-index:update',
      expect.objectContaining({
        data: expect.objectContaining({
          trained_chara: ownRows,
          succession_trained_chara_data: rentalData,
        }),
      }),
    );
  });

  test('captures the standalone pre_single_mode packet shape with rental factors', () => {
    const send = jest.fn();
    const mainWindow = { webContents: { send } } as any;
    const rentalRow = {
      viewer_id: 9,
      trained_chara_id: 2,
      card_id: 100402,
      factor_info_array: [
        { factor_id: 503 },
        { factor_id: 3102 },
        { factor_id: 1000302 },
        { factor_id: 10040201 },
      ],
      succession_chara_array: [
        {
          position_id: 10,
          card_id: 101001,
          factor_info_array: [{ factor_id: 402 }, { factor_id: 1201 }],
        },
        {
          position_id: 20,
          card_id: 105101,
          factor_info_array: [{ factor_id: 302 }, { factor_id: 3102 }],
        },
      ],
    };

    expect(
      captureSuccessionIndex(
        {
          response_code: 1,
          data_headers: {},
          data: {
            friend_support_card_data: { summary_user_info_array: [] },
            succession_trained_chara_data: {
              succession_trained_chara_array: [rentalRow],
              summary_user_info_array: [{ viewer_id: 9, name: '好友' }],
            },
            event_succession_trained_chara_data: {
              succession_trained_chara_array: [],
              summary_user_info_array: [],
            },
          },
        },
        mainWindow,
      ),
    ).toBe(true);
    expect(send).toHaveBeenLastCalledWith(
      'succession-index:update',
      expect.objectContaining({
        data: expect.objectContaining({
          succession_trained_chara_data: expect.objectContaining({
            succession_trained_chara_array: [rentalRow],
          }),
        }),
      }),
    );
  });

  test('preserves pre_single_mode rentals when load/index arrives later', () => {
    const send = jest.fn();
    const mainWindow = { webContents: { send } } as any;
    const rentalData = {
      summary_user_info_array: [{ viewer_id: 9, name: '好友' }],
      succession_trained_chara_array: [
        {
          viewer_id: 9,
          trained_chara_id: 2,
          factor_info_array: [{ factor_id: 2202 }],
        },
      ],
    };
    const ownRows = [
      {
        trained_chara_id: 1,
        factor_info_array: [{ factor_id: 402 }],
      },
    ];

    captureSuccessionIndex(
      { data: { succession_trained_chara_data: rentalData } },
      mainWindow,
    );
    captureSuccessionIndex(
      {
        data: {
          trained_chara: ownRows,
          succession_trained_chara_data: {
            summary_user_info_array: [],
            succession_trained_chara_array: [],
          },
        },
      },
      mainWindow,
    );

    expect(send).toHaveBeenLastCalledWith(
      'succession-index:update',
      expect.objectContaining({
        data: expect.objectContaining({
          trained_chara: ownRows,
          succession_trained_chara_data: rentalData,
        }),
      }),
    );
  });
});
