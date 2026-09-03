import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { app, IpcMain } from 'electron';
import {
  getAutoResearchAccountCredential,
  getAutoResearchCurrentSession,
  storeAutoResearchGameClientSession,
} from './AutoResearchCredentials';
import { SuccessionGameClient } from './SuccessionGameClient';

type DailyConfig = Record<string, any>;
type TaskResult = Record<string, any>;

const DAILY_RACE_TICKET = 96;
const DAILY_LEGEND_TICKET = 168;

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function masterDatabasePath() {
  const candidates = app.isPackaged
    ? [path.join(process.resourcesPath, 'master.mdb')]
    : [path.join(app.getAppPath(), 'master.mdb'), path.resolve('master.mdb')];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error('UmaShow 本地 master.mdb 不存在');
  return found;
}

function distanceType(distance: number) {
  if (distance <= 1400) return 'short';
  if (distance <= 1800) return 'mile';
  if (distance <= 2400) return 'middle';
  return 'long';
}

function itemMap(data: Record<string, any>) {
  const result = new Map<number, number>();
  const rows = data.user_item || data.user_item_array || data.item_list || [];
  rows.forEach((row: Record<string, any>) => {
    const id = numberValue(row.item_id);
    if (id > 0) result.set(id, numberValue(row.number));
  });
  return result;
}

function updateItems(items: Map<number, number>, rows: unknown) {
  if (!Array.isArray(rows)) return;
  rows.forEach((row) => {
    const id = numberValue(row?.item_id);
    if (id > 0 && row?.number != null) items.set(id, numberValue(row.number));
  });
}

function trainedCharas(data: Record<string, any>, database: Database.Database) {
  const nameQuery = database.prepare(`
    SELECT text.text AS name
    FROM card_data AS card
    LEFT JOIN text_data AS text
      ON text."index" = card.chara_id AND text.category = 14
    WHERE card.id = ?
    LIMIT 1
  `);
  return (data.trained_chara || [])
    .map((row: Record<string, any>) => {
      const cardId = numberValue(row.card_id);
      const name = (nameQuery.get(cardId) as { name?: string } | undefined)?.name;
      return {
        trained_chara_id: numberValue(row.trained_chara_id),
        card_id: cardId,
        name: name || `未知角色 (${cardId})`,
        rank_score: numberValue(row.rank_score),
        running_style: Math.max(1, numberValue(row.running_style, 1)),
        rarity: numberValue(row.rarity),
        race_cloth_id: numberValue(row.race_cloth_id),
        speed: numberValue(row.speed),
        stamina: numberValue(row.stamina),
        power: numberValue(row.pow),
        guts: numberValue(row.guts),
        wit: numberValue(row.wiz),
        proper_distance_short: numberValue(row.proper_distance_short),
        proper_distance_mile: numberValue(row.proper_distance_mile),
        proper_distance_middle: numberValue(row.proper_distance_middle),
        proper_distance_long: numberValue(row.proper_distance_long),
        proper_running_style_nige: numberValue(row.proper_running_style_nige),
        proper_running_style_senko: numberValue(row.proper_running_style_senko),
        proper_running_style_sashi: numberValue(row.proper_running_style_sashi),
        proper_running_style_oikomi: numberValue(row.proper_running_style_oikomi),
        proper_ground_turf: numberValue(row.proper_ground_turf),
        proper_ground_dirt: numberValue(row.proper_ground_dirt),
      };
    })
    .filter((row: Record<string, any>) => row.trained_chara_id > 0)
    .sort(
      (left: Record<string, any>, right: Record<string, any>) =>
        right.rank_score - left.rank_score,
    );
}

function buildOptions(data: Record<string, any>) {
  const database = new Database(masterDatabasePath(), {
    readonly: true,
    fileMustExist: true,
  });
  try {
    const pieces = new Map<number, number>(
      (data.piece_list || []).map((row: Record<string, any>) => [
        numberValue(row.piece_id),
        numberValue(row.number),
      ]),
    );
    const dailyRaces = database
      .prepare(`
        SELECT daily.id, daily.group_id, daily.difficulty,
               course.distance, course.ground, course.race_track_id
        FROM daily_race AS daily
        JOIN race_instance AS instance ON instance.id = daily.race_instance_id
        JOIN race AS race_master ON race_master.id = instance.race_id
        JOIN race_course_set AS course ON course.id = race_master.course_set
        ORDER BY daily.group_id, daily.difficulty
      `)
      .all()
      .map((row: any) => ({
        ...row,
        distance_type: distanceType(numberValue(row.distance)),
        ground_name: numberValue(row.ground) === 1 ? '芝' : '泥地',
        name:
          numberValue(row.group_id) === 1
            ? '金币赛事'
            : numberValue(row.group_id) === 4
              ? '协助积分赛事'
              : `日常赛事组 ${row.group_id}`,
      }));
    const legendRaces = database
      .prepare(`
        SELECT daily.id, daily.image_id AS card_id,
               daily.pick_up_item_id_1 AS piece_id, daily.difficulty,
               course.distance, course.ground, course.race_track_id,
               text.text AS name
        FROM daily_legend_race AS daily
        JOIN race_instance AS instance ON instance.id = daily.race_instance_id
        JOIN race AS race_master ON race_master.id = instance.race_id
        JOIN race_course_set AS course ON course.id = race_master.course_set
        LEFT JOIN card_data AS card ON card.id = daily.image_id
        LEFT JOIN text_data AS text
          ON text."index" = card.chara_id AND text.category = 14
        ORDER BY daily.id
      `)
      .all()
      .map((row: any) => ({
        ...row,
        name: row.name || `传奇赛事 ${row.id}`,
        owned_piece_count: pieces.get(numberValue(row.piece_id)) || 0,
        distance_type: distanceType(numberValue(row.distance)),
        ground_name: numberValue(row.ground) === 1 ? '芝' : '泥地',
      }));
    const items = itemMap(data);
    const dailyRecords =
      data.daily_race_playing_info?.daily_race_record_array || [];
    const legendInfo = data.daily_legend_race_playing_info;
    const rp = numberValue(
      data.user_info?.current_rp ?? data.rp_info?.current_rp,
    );
    const stadiumAvailable = Boolean(
      data.team_stadium_user && (data.team_data_array || []).length,
    );
    return {
      daily_races: dailyRaces,
      daily_legend_races: legendRaces,
      trained_charas: trainedCharas(data, database),
      availability: {
        daily_race: {
          available: dailyRecords.length > 0,
          can_run_now:
            dailyRecords.length > 0 && (items.get(DAILY_RACE_TICKET) || 0) > 0,
          ticket_count: items.get(DAILY_RACE_TICKET) || 0,
          reason: dailyRecords.length ? '' : '当前账号没有可参加的每日竞赛',
        },
        daily_legend_race: {
          available: Boolean(legendInfo && 'state' in legendInfo),
          can_run_now:
            Boolean(legendInfo && 'state' in legendInfo) &&
            (items.get(DAILY_LEGEND_TICKET) || 0) > 0,
          ticket_count: items.get(DAILY_LEGEND_TICKET) || 0,
          reason: legendInfo ? '' : '当前账号没有可参加的每日传奇赛事',
        },
        team_stadium: {
          available: stadiumAvailable,
          can_run_now: stadiumAvailable && rp > 0,
          current_rp: rp,
          term_open: stadiumAvailable,
          reason: stadiumAvailable ? '' : '当前账号没有配置竞技场队伍',
        },
      },
    };
  } finally {
    database.close();
  }
}

function createClient(id: string) {
  const credential = getAutoResearchAccountCredential(id);
  const session = getAutoResearchCurrentSession(id);
  if (!session?.sid) throw new Error('请先登录');
  return new SuccessionGameClient(
    credential.uid,
    credential.accessKey,
    undefined,
    session,
  );
}

async function overview(id: string, config: DailyConfig) {
  const client = createClient(id);
  try {
    const loaded = await client.loadIndex();
    return {
      success: true,
      daily_tasks: { ...config, status: 'paused', task_results: {} },
      options: buildOptions(loaded.data || {}),
    };
  } finally {
    storeAutoResearchGameClientSession(client.session);
  }
}

async function run(id: string, config: DailyConfig) {
  const client = createClient(id);
  const results: Record<string, TaskResult> = {};
  const errors: string[] = [];
  const startedAt = new Date().toISOString();
  let loadedData: Record<string, any> = {};
  let items = new Map<number, number>();

  const execute = async (name: string, action: () => Promise<TaskResult>) => {
    try {
      const result = await action();
      results[name] = { ...result, finished_at: new Date().toISOString() };
      return result;
    } catch (error) {
      const detail = (error as Error).message;
      results[name] = {
        status: 'error',
        detail,
        finished_at: new Date().toISOString(),
      };
      errors.push(`${name}: ${detail}`);
      return results[name];
    }
  };

  try {
    const loaded = await client.loadIndex();
    loadedData = loaded.data || {};
    if (loadedData.single_mode_chara_light || loadedData.single_mode_chara) {
      throw new Error('育成进行中，不能执行本地日常');
    }
    items = itemMap(loadedData);
    const horses = new Map<number, Record<string, any>>(
      (loadedData.trained_chara || []).map((horse: Record<string, any>) => [
        numberValue(horse.trained_chara_id),
        horse,
      ]),
    );

    const runShop = async (source: string) => {
      if (!config.limited_shop?.enabled) return;
      await execute('limited_shop', async () => {
        const refreshed = await client.loadIndex();
        items = itemMap(refreshed.data || {});
        const shown = await client.call('item/show_exchange', {
          is_not_update: false,
        });
        const data = shown.data || {};
        const info = data.limited_shop_info || {};
        const goods = (data.limited_goods_info_array || []).filter(
          (item: Record<string, any>) => numberValue(item.exchange_count) <= 0,
        );
        if (!numberValue(info.open_flag) || !goods.length) {
          return { status: 'skipped', detail: `${source}后没有可购买的限时商店` };
        }
        const database = new Database(masterDatabasePath(), {
          readonly: true,
          fileMustExist: true,
        });
        try {
          const query = database.prepare(`
            SELECT reward.id AS reward_id, exchange_item.id AS exchange_id,
                   exchange_item.pay_item_id, exchange_item.pay_item_num
            FROM limited_exchange_reward AS reward
            JOIN item_exchange AS exchange_item
              ON exchange_item.id = reward.item_exchange_id
            WHERE reward.id = ?
          `);
          const rows = goods.map((good: Record<string, any>) => {
            const master = query.get(numberValue(good.reward_id)) as any;
            if (!master) throw new Error('限时商店商品价格读取失败，未购买');
            return { ...master, open_count: numberValue(good.open_count) };
          });
          const required = new Map<number, number>();
          rows.forEach((row: any) =>
            required.set(
              numberValue(row.pay_item_id),
              (required.get(numberValue(row.pay_item_id)) || 0) +
                numberValue(row.pay_item_num),
            ),
          );
          if (
            [...required].some(
              ([itemId, count]) => (items.get(itemId) || 0) < count,
            )
          ) {
            return {
              status: 'skipped',
              detail: '货币不足，按全有或全无规则未购买任何商品',
            };
          }
          const serverTime = numberValue(shown.data_headers?.servertime);
          const listTime = new Date(
            (serverTime > 0 ? serverTime * 1000 : Date.now()) + 8 * 60 * 60 * 1000,
          )
            .toISOString()
            .replace('T', ' ')
            .replace('Z', '')
            .slice(0, 19)
            .replace(/-/g, '/');
          const exchanged = await client.call('item/exchange_multi', {
            exchange_item_info_array: rows.map((row: any) => ({
              exchange_id: numberValue(row.exchange_id),
              count: 1,
              ex_param: { open_count: numberValue(row.open_count) },
            })),
            use_item_info_array: [...required.keys()].map((itemId) => ({
              item_id: itemId,
              number: items.get(itemId) || 0,
            })),
            get_list_time: listTime,
          });
          updateItems(items, exchanged.data?.use_item_info_array);
          return {
            status: 'completed',
            detail: `已一次性购买 ${rows.length} 件限时商店商品`,
            count: rows.length,
          };
        } finally {
          database.close();
        }
      });
    };

    if (config.daily_race?.enabled) {
      const result = await execute('daily_race', async () => {
        const raceId = numberValue(config.daily_race.daily_race_id);
        const trainedId = numberValue(config.daily_race.trained_chara_id);
        const horse = horses.get(trainedId);
        if (!raceId || !horse) throw new Error('请选择有效的每日竞赛和参赛马娘');
        const index = await client.call('daily_race/index');
        const record = (index.data?.daily_race_record_array || []).find(
          (row: Record<string, any>) => numberValue(row.daily_race_id) === raceId,
        );
        if (!record) throw new Error('所选每日竞赛当前不可用');
        if (!numberValue(record.is_cleared)) throw new Error('所选每日竞赛尚未通关');
        const count = items.get(DAILY_RACE_TICKET) || 0;
        if (!count) return { status: 'skipped', detail: '每日竞赛入场券为 0' };
        const response = await client.call('daily_race_skip/race_skip', {
          daily_race_id: raceId,
          trained_chara_id: trainedId,
          race_skip_count: count,
          client_own_num: count,
          running_style:
            numberValue(config.daily_race.running_style) ||
            Math.max(1, numberValue(horse.running_style, 1)),
        });
        updateItems(items, response.data?.item_info_array);
        return { status: 'completed', detail: `已使用 ${count} 张入场券`, count };
      });
      if (result.status === 'completed') await runShop('每日竞赛');
    }

    if (config.daily_legend_race?.enabled) {
      const result = await execute('daily_legend_race', async () => {
        const raceId = numberValue(config.daily_legend_race.daily_legend_race_id);
        const trainedId = numberValue(config.daily_legend_race.trained_chara_id);
        const horse = horses.get(trainedId);
        if (!raceId || !horse) throw new Error('请选择有效的每日传奇赛事和参赛马娘');
        const index = await client.call('daily_legend_race/index');
        updateItems(items, index.data?.update_item_array);
        const available = (index.data?.daily_legend_race_record_array || []).some(
          (row: Record<string, any>) =>
            numberValue(row.daily_legend_race_id) === raceId,
        );
        if (!available) throw new Error('所选每日传奇赛事当前不可用');
        if (!(items.get(DAILY_LEGEND_TICKET) || 0)) {
          return { status: 'skipped', detail: '每日传奇赛事入场券为 0' };
        }
        await client.call('daily_legend_race/race_entry', {
          daily_legend_race_id: raceId,
          trained_chara_id: trainedId,
        });
        const reflected = await client.call(
          'daily_legend_race/reflect_item_effect',
          { item_id_array: [] },
        );
        updateItems(items, reflected.data?.item_info_array);
        await client.call('daily_legend_race/race_start', {
          running_style:
            numberValue(config.daily_legend_race.running_style) ||
            Math.max(1, numberValue(horse.running_style, 1)),
          is_short: 1,
        });
        const replay = await client.call('daily_legend_race/replay_check');
        return {
          status: 'completed',
          detail: `已完成每日传奇赛事，名次 ${numberValue(replay.data?.rank)}`,
          count: 1,
        };
      });
      if (result.status === 'completed') await runShop('每日传奇赛事');
    }

    if (config.team_stadium?.enabled) {
      const result = await execute('team_stadium', async () => {
        let remaining = numberValue(
          loadedData.user_info?.current_rp ?? loadedData.rp_info?.current_rp,
        );
        let count = 0;
        while (remaining > 0 && count < 5) {
          const index = await client.call('team_stadium/index');
          if (numberValue(index.data?.term_state, 1) !== 1) break;
          const opponents = await client.call('team_stadium/opponent_list');
          if (!(opponents.data?.opponent_info_array || []).length) break;
          await client.call('team_stadium/decide_frame_order', {
            opponent_strength: 3,
          });
          const started = await client.call('team_stadium/start', {
            item_id_array: [],
          });
          await client.call('team_stadium/replay_check', { round: 5 });
          await client.call('team_stadium/all_race_end');
          count += 1;
          remaining =
            started.data?.rp_info?.current_rp == null
              ? remaining - 1
              : Math.max(0, numberValue(started.data.rp_info.current_rp));
          await runShop('竞技场');
        }
        return {
          status: count ? 'completed' : 'skipped',
          detail: `已参加 ${count} 次竞技场，未使用恢复道具`,
          count,
        };
      });
      void result;
    }

    const finishedAt = new Date().toISOString();
    const refreshed = await client.loadIndex();
    return {
      success: true,
      daily_tasks: {
        ...config,
        status: errors.length ? 'completed_with_errors' : 'completed',
        last_started_at: startedAt,
        last_finished_at: finishedAt,
        last_error: errors.join('；'),
        task_results: results,
      },
      options: buildOptions(refreshed.data || {}),
    };
  } finally {
    storeAutoResearchGameClientSession(client.session);
  }
}

export default function handleAutoResearchDailyTasks(ipcMain: IpcMain) {
  ipcMain.handle(
    'autoresearch:daily-tasks-overview',
    (_, id: string, config: DailyConfig) => overview(id, config),
  );
  ipcMain.handle(
    'autoresearch:daily-tasks-run',
    (_, id: string, config: DailyConfig) => run(id, config),
  );
}
