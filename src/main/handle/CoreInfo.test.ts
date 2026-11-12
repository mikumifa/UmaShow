import type { BrowserWindow } from 'electron';
import { extractCoreInfo } from './CoreInfo';

jest.mock('electron-log', () => ({ info: jest.fn() }));
jest.mock('main/paths', () => ({ TRAINING_HISTORY_DIR: '/training-history' }));
jest.mock('./StoryDetail', () => ({ fetchStoryDetail: jest.fn() }));
jest.mock('./Data', () => ({
  UMDB: {
    supportCards: { 30160: { charaId: 1001 } },
    charas: { 1001: { iconUrl: 'chara/1001.png' } },
    charaEffectTexts: {},
    stories: [],
  },
}));

test('forwards bond and story progress for legacy and target-id partners', async () => {
  const send = jest.fn();
  await extractCoreInfo(
    {
      response_code: 1,
      data: {
        chara_info: {
          scenario_id: 6,
          support_card_array: [{ position: 1, support_card_id: 30160 }],
          evaluation_info_array: [
            {
              training_partner_id: 1,
              evaluation: 85,
              story_step: 0,
              is_appear: 1,
            },
            { target_id: 7, evaluation: 62, story_step: 3, is_appear: 0 },
            { target_id: 102, evaluation: 40 },
          ],
        },
        arc_data_set: {
          evaluation_info_array: [{ target_id: 7, chara_id: 9043 }],
        },
      },
    },
    { webContents: { send } } as unknown as BrowserWindow,
  );

  expect(send).toHaveBeenCalledWith(
    'core-info-update',
    expect.objectContaining({
      partnerStats: [
        expect.objectContaining({
          position: 1,
          charaId: 1001,
          charaPath: 'chara/1001.png',
          evaluation: 85,
          storyStep: 0,
          isAppear: true,
        }),
        expect.objectContaining({
          position: 7,
          charaId: 9043,
          charaPath: './icons/chara/chr_icon_training_9043.png',
          evaluation: 62,
          storyStep: 3,
          isAppear: false,
        }),
        expect.objectContaining({
          position: 102,
          evaluation: 40,
          storyStep: undefined,
          isAppear: undefined,
        }),
      ],
    }),
  );
});
