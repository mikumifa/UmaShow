import https from 'https';
import zlib from 'zlib';
import log from 'electron-log';
import type { IpcMain } from 'electron';
import type { StoryDetail } from 'types/gameTypes';

const storyDetailCache = new Map<number, StoryDetail>();
const storyDetailInFlight = new Map<number, Promise<StoryDetail | null>>();

export const fetchStoryDetail = (
  storyId: number,
): Promise<StoryDetail | null> => {
  if (!Number.isInteger(storyId) || storyId <= 0) {
    return Promise.resolve(null);
  }
  const cached = storyDetailCache.get(storyId);
  if (cached) {
    return Promise.resolve(cached);
  }
  const inflight = storyDetailInFlight.get(storyId);
  if (inflight) {
    return inflight;
  }

  const request = new Promise<StoryDetail | null>((resolve) => {
    const url = `https://le3-api.game.bilibili.com/x/api/umav1/story/detail?story_id=${storyId}`;
    const storyRequest = https.get(
      url,
      {
        headers: {
          'User-Agent':
            'Dalvik/2.1.0 (Linux; U; Android 12; 22041216C Build/688207e.0)',
          Connection: 'Keep-Alive',
          'Accept-Encoding': 'gzip',
        },
      },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          resolve(null);
          return;
        }

        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          const encoding = res.headers['content-encoding'];
          const handleBody = (body: Buffer) => {
            try {
              const parsed = JSON.parse(body.toString('utf-8'));
              if (!parsed?.data || typeof parsed.data !== 'object') {
                resolve(null);
                return;
              }
              const optionList = Array.isArray(parsed.data.option_list)
                ? parsed.data.option_list
                : [];
              const detail: StoryDetail = {
                storyId,
                optionList: optionList.map((option: any) => ({
                  option: String(option?.option ?? ''),
                  gainList: Array.isArray(option?.gain_list)
                    ? option.gain_list.map((gain: any) => String(gain))
                    : [],
                })),
              };
              storyDetailCache.set(storyId, detail);
              resolve(detail);
            } catch (error) {
              log.warn('story detail parse failed:', error);
              resolve(null);
            }
          };

          if (encoding === 'gzip') {
            zlib.gunzip(buffer, (error, decoded) => {
              if (error) {
                resolve(null);
                return;
              }
              handleBody(decoded);
            });
          } else {
            handleBody(buffer);
          }
        });
      },
    );
    storyRequest.on('error', (error) => {
      log.warn('story detail request failed:', error);
      resolve(null);
    });
    storyRequest.setTimeout(10000, () => {
      storyRequest.destroy(new Error('story detail request timed out'));
    });
  }).finally(() => {
    storyDetailInFlight.delete(storyId);
  });

  storyDetailInFlight.set(storyId, request);
  return request;
};

export default function handleStoryDetail(ipcMain: IpcMain) {
  ipcMain.handle('story-detail:get', (_event, storyId: number) =>
    fetchStoryDetail(Number(storyId)),
  );
}
