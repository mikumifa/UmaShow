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

  test('keeps the logged-in viewer id for owned-row validation', () => {
    const send = jest.fn();
    const mainWindow = { webContents: { send } } as any;
    captureSuccessionIndex(
      {
        data_headers: { viewer_id: 876724857032 },
        data: { trained_chara: [] },
      },
      mainWindow,
    );

    expect(send).toHaveBeenLastCalledWith(
      'succession-index:update',
      expect.objectContaining({ viewerId: 876724857032 }),
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

  test('replaces rentals while retaining the cached owned list', () => {
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

  test('replaces all rentals when a later packet contains a new rental list', () => {
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
          succession_trained_chara_data: {
            summary_user_info_array: [],
            succession_trained_chara_array: [],
          },
        }),
      }),
    );
  });

  test('replaces all owned umas, including with an empty list', () => {
    const send = jest.fn();
    const mainWindow = { webContents: { send } } as any;
    const ownRows = [
      {
        trained_chara_id: 1,
        factor_info_array: [{ factor_id: 402 }],
      },
    ];

    captureSuccessionIndex({ data: { trained_chara: ownRows } }, mainWindow);
    captureSuccessionIndex({ data: { trained_chara: [] } }, mainWindow);

    expect(send).toHaveBeenLastCalledWith(
      'succession-index:update',
      expect.objectContaining({
        data: expect.objectContaining({
          trained_chara: [],
          trained_chara_array: undefined,
        }),
      }),
    );
  });

  test('clears the old owned-list field when a new packet uses the other shape', () => {
    const send = jest.fn();
    const mainWindow = { webContents: { send } } as any;
    const directRows = [
      {
        trained_chara_id: 1,
        factor_info_array: [{ factor_id: 402 }],
      },
    ];
    const fallbackRows = [
      {
        trained_chara_id: 2,
        factor_info_array: [{ factor_id: 503 }],
      },
    ];

    captureSuccessionIndex({ data: { trained_chara: directRows } }, mainWindow);
    captureSuccessionIndex(
      { data: { trained_chara_array: fallbackRows } },
      mainWindow,
    );

    expect(send).toHaveBeenLastCalledWith(
      'succession-index:update',
      expect.objectContaining({
        data: expect.objectContaining({
          trained_chara: undefined,
          trained_chara_array: fallbackRows,
        }),
      }),
    );
  });

  test('replaces fallback owned rows with an empty index list', () => {
    const send = jest.fn();
    const mainWindow = { webContents: { send } } as any;
    const fallbackRows = [
      {
        trained_chara_id: 2,
        factor_info_array: [{ factor_id: 503 }],
      },
    ];

    captureSuccessionIndex(
      { data: { trained_chara_array: fallbackRows } },
      mainWindow,
    );
    captureSuccessionIndex(
      { data: { card_list: [], trained_chara_array: [] } },
      mainWindow,
    );

    expect(send).toHaveBeenLastCalledWith(
      'succession-index:update',
      expect.objectContaining({
        data: expect.objectContaining({
          trained_chara: undefined,
          trained_chara_array: [],
        }),
      }),
    );
  });

  test('keeps each cached list when an unrelated packet arrives', () => {
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

    captureSuccessionIndex(
      {
        data: {
          trained_chara: ownRows,
          succession_trained_chara_data: rentalData,
        },
      },
      mainWindow,
    );

    expect(
      captureSuccessionIndex(
        { data: { opponent_info: { trained_chara_array: [] } } },
        mainWindow,
      ),
    ).toBe(false);
    expect(send).toHaveBeenCalledTimes(1);
  });
});
