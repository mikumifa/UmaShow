import fs from 'fs';
import path from 'path';
import { TRAINING_HISTORY_DIR } from 'main/paths';
import storyProgressEvents from '../../../assets/data/story_progress_events.json';
import storyProgressData from '../../../assets/data/story_progress.json';

type StoryEvent = {
  supportCardId: number;
  charaId: number;
  step: number;
  total: number;
};
type StoryProgress = {
  byCard: Map<number, number>;
  byChara: Map<number, number>;
};
const eventCatalog = storyProgressEvents as Record<string, StoryEvent>;
const outingTotals = storyProgressData.outingTotals as Record<string, number>;
const progressByRun = new Map<string, StoryProgress>();

function collectEvents(progress: StoryProgress, data: Record<string, any>) {
  (data.unchecked_event_array ?? []).forEach((event: any) => {
    const story = eventCatalog[event.story_id];
    if (!story) return;
    const cardId =
      story.supportCardId || event.event_contents_info?.support_card_id;
    if (cardId > 0) {
      progress.byCard.set(
        cardId,
        Math.max(progress.byCard.get(cardId) ?? 0, story.step),
      );
    }
    if (story.charaId > 0) {
      progress.byChara.set(
        story.charaId,
        Math.max(progress.byChara.get(story.charaId) ?? 0, story.step),
      );
    }
  });
}

// Restore this run's events on first use, including when the app restarts
// halfway through training. Repeated packets advance by stage, not event count.
export function capturePartnerStoryProgress(
  data: Record<string, any>,
  viewerId: number | undefined,
): StoryProgress {
  const chara = data.chara_info ?? {};
  const runId = Number(chara.single_mode_chara_id);
  const canRestore =
    Number.isSafeInteger(viewerId) &&
    viewerId! > 0 &&
    Number.isSafeInteger(runId) &&
    runId > 0;
  const key = `${viewerId}:${runId}:${chara.start_time ?? ''}`;
  let progress = canRestore ? progressByRun.get(key) : undefined;
  if (!progress) {
    progress = { byCard: new Map(), byChara: new Map() };
    if (canRestore) {
      const file = path.join(
        TRAINING_HISTORY_DIR,
        `training_history_${viewerId}_${runId}.jsonl`,
      );
      try {
        if (fs.existsSync(file)) {
          fs.readFileSync(file, 'utf8')
            .split('\n')
            .forEach((line) => {
              if (!line.trim()) return;
              try {
                const packet = JSON.parse(line).payload?.data;
                const previous = packet?.single_mode_load_common ?? packet;
                const previousChara = previous?.chara_info;
                if (!previous || !previousChara) return;
                if (Number(previousChara.single_mode_chara_id) !== runId)
                  return;
                if (
                  chara.start_time != null &&
                  previousChara.start_time != null &&
                  chara.start_time !== previousChara.start_time
                )
                  return;
                collectEvents(progress!, previous);
              } catch {
                // A partially written line must not hide the rest of the history.
              }
            });
        }
      } catch {
        // Live packets can still advance progress when history is unavailable.
      }
      progressByRun.set(key, progress);
      if (progressByRun.size > 8) {
        progressByRun.delete(progressByRun.keys().next().value!);
      }
    }
  }
  collectEvents(progress, data);
  return progress;
}

export function resolvePartnerStoryStep(
  progress: StoryProgress,
  supportCardId: number,
  charaId: number | undefined,
  packetStep: number | undefined,
): number | undefined {
  // story_step is authoritative for outings; normal support event chains
  // keep story_step at zero and need their observed story IDs instead.
  if (outingTotals[supportCardId] > 0 && packetStep != null) return packetStep;
  const observed =
    progress.byCard.get(supportCardId) ??
    (charaId ? progress.byChara.get(charaId) : undefined);
  if (observed == null) return packetStep;
  return Math.max(observed, packetStep ?? 0);
}
