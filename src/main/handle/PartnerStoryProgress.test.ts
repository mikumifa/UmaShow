import fs from 'fs';
import {
  capturePartnerStoryProgress,
  resolvePartnerStoryStep,
} from './PartnerStoryProgress';

jest.mock('main/paths', () => ({ TRAINING_HISTORY_DIR: '/training-history' }));
jest.mock('fs', () => ({ existsSync: jest.fn(), readFileSync: jest.fn() }));

const data = (runId: number, storyIds: number[] = []) => ({
  chara_info: {
    single_mode_chara_id: runId,
    start_time: '2026-11-13 00:00:00',
  },
  unchecked_event_array: storyIds.map((story_id) => ({ story_id })),
});

beforeEach(() => jest.clearAllMocks());

test('normal support events advance by database stage despite story_step staying zero', () => {
  let progress = capturePartnerStoryProgress(data(1, [830147001]), 123);
  expect(resolvePartnerStoryStep(progress, 30147, 1094, 0)).toBe(1);
  progress = capturePartnerStoryProgress(data(1, [830147001]), 123);
  expect(resolvePartnerStoryStep(progress, 30147, 1094, 0)).toBe(1);
  progress = capturePartnerStoryProgress(data(1, [830147002]), 123);
  expect(resolvePartnerStoryStep(progress, 30147, 1094, 0)).toBe(2);
  progress = capturePartnerStoryProgress(data(1), 123);
  expect(resolvePartnerStoryStep(progress, 30147, 1094, 0)).toBe(2);
  progress = capturePartnerStoryProgress(data(2), 123);
  expect(resolvePartnerStoryStep(progress, 30147, 1094, 0)).toBe(0);
});

test('restores events from this run while ignoring broken lines and other runs', () => {
  jest.mocked(fs.existsSync).mockReturnValueOnce(true);
  jest
    .mocked(fs.readFileSync)
    .mockReturnValueOnce(
      [
        JSON.stringify({ payload: { data: data(3, [830147001]) } }),
        'incomplete line',
        JSON.stringify({ payload: { data: data(3, [830147002]) } }),
        JSON.stringify({ payload: { data: data(99, [830147003]) } }),
      ].join('\n'),
    );
  const progress = capturePartnerStoryProgress(data(3), 123);
  expect(resolvePartnerStoryStep(progress, 30147, 1094, 0)).toBe(2);
  capturePartnerStoryProgress(data(3), 123);
  expect(fs.readFileSync).toHaveBeenCalledTimes(1);
});

test('keeps the packet outing stage authoritative for friend cards', () => {
  const progress = capturePartnerStoryProgress(data(4, [830160001]), 123);
  expect(resolvePartnerStoryStep(progress, 30160, 9043, 2)).toBe(2);
});
