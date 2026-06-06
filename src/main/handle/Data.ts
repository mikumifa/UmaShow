import fs from 'fs';
import path from 'path';
import log from 'electron-log';
import _ from 'lodash';
import { APP_PATH, ASSETS_PATH } from 'main/paths';
import pako from 'pako';
import {
  Card,
  Chara,
  LiveSong,
  RaceInstance,
  Skill,
  UMDatabase,
} from 'umdb/data_pb';
import { Story } from 'umdb/UMDatabaseUtils';
import type {
  SupportCardMetaFile,
  SupportCardWithMeta,
} from 'types/supportCard';

export const UMDB = {
  charas: {} as Record<number, Chara>,
  cards: {} as Record<number, Card>,
  cardRarityData: {} as Record<number, Record<number, number>>,
  cardTalentRates: {} as Record<
    number,
    {
      speed: number;
      stamina: number;
      power: number;
      guts: number;
      wiz: number;
    }
  >,
  supportCards: {} as Record<number, SupportCardWithMeta>,
  supportCardLevels: {} as Record<string, Record<string, number>>,
  supportCardEffectTypes: {} as Record<string, string>,
  liveSongs: {} as Record<number, LiveSong>,
  charaEffectTexts: {} as Record<number, string>,
  skillTipNames: {} as Record<number, Record<number, string>>,
  successionRelationMemberCharaIds: {} as Record<number, Set<number>>,
  raceInstances: {} as Record<number, RaceInstance>,
  skills: {} as Record<number, Skill>,
  interestingRaceInstances: [] as RaceInstance[],
  stories: [] as Story[],
};

export function UMDBload() {
  try {
    const filePath = path.join(ASSETS_PATH, 'data', 'umdb.binarypb.gz');
    const supportCardMetaPaths = [
      path.join(ASSETS_PATH, 'data', 'support_card_meta.json'),
      path.join(process.cwd(), 'support_card_meta.generated.json'),
    ];
    const umdbJsonPath = path.join(ASSETS_PATH, 'data', 'umdb.json');
    const supportCardMetaPath = supportCardMetaPaths.find((candidate) =>
      fs.existsSync(candidate),
    );
    if (!fs.existsSync(filePath)) {
      log.error(`[UMDB] ❌ DB file not found: ${filePath}`);
      return;
    }
    const gzData = fs.readFileSync(filePath);
    const inflated = pako.inflate(gzData);
    const umdb = UMDatabase.fromBinary(inflated);
    let supportCardMetaFile: SupportCardMetaFile | null = null;
    UMDB.supportCardLevels = {};
    UMDB.supportCardEffectTypes = {};
    UMDB.charaEffectTexts = {};
    UMDB.skillTipNames = {};
    UMDB.cardRarityData = {};
    UMDB.cardTalentRates = {};
    if (fs.existsSync(umdbJsonPath)) {
      const umdbJson = JSON.parse(fs.readFileSync(umdbJsonPath, 'utf-8')) as {
        charaEffectTexts?: Record<string, string>;
        skillTipNames?: Record<string, Record<string, string>>;
        cardRarityData?: Record<string, Record<string, number>>;
        cardTalentRates?: Record<
          string,
          {
            speed?: number;
            stamina?: number;
            power?: number;
            guts?: number;
            wiz?: number;
          }
        >;
      };
      UMDB.charaEffectTexts = Object.fromEntries(
        Object.entries(umdbJson.charaEffectTexts ?? {}).map(([id, text]) => [
          Number(id),
          text,
        ]),
      );
      UMDB.skillTipNames = Object.fromEntries(
        Object.entries(umdbJson.skillTipNames ?? {}).map(
          ([groupId, rarityMap]) => [
            Number(groupId),
            Object.fromEntries(
              Object.entries(rarityMap).map(([rarity, name]) => [
                Number(rarity),
                name,
              ]),
            ),
          ],
        ),
      );
      UMDB.cardRarityData = Object.fromEntries(
        Object.entries(umdbJson.cardRarityData ?? {}).map(
          ([cardId, rarityMap]) => [
            Number(cardId),
            Object.fromEntries(
              Object.entries(rarityMap).map(([rarity, raceDressId]) => [
                Number(rarity),
                Number(raceDressId),
              ]),
            ),
          ],
        ),
      );
      UMDB.cardTalentRates = Object.fromEntries(
        Object.entries(umdbJson.cardTalentRates ?? {}).map(
          ([cardId, rates]) => [
            Number(cardId),
            {
              speed: Number(rates.speed ?? 0),
              stamina: Number(rates.stamina ?? 0),
              power: Number(rates.power ?? 0),
              guts: Number(rates.guts ?? 0),
              wiz: Number(rates.wiz ?? 0),
            },
          ],
        ),
      );
    }
    if (supportCardMetaPath) {
      supportCardMetaFile = JSON.parse(
        fs.readFileSync(supportCardMetaPath, 'utf-8'),
      ) as SupportCardMetaFile;
      UMDB.supportCardLevels = supportCardMetaFile.supportCardLevels ?? {};
      UMDB.supportCardEffectTypes =
        supportCardMetaFile.supportCardEffectTypes ?? {};
    }
    // ---- chara
    umdb.chara.forEach((c) => (UMDB.charas[c.id!] = c));
    // ---- card
    umdb.card.forEach((card) => (UMDB.cards[card.id!] = card));
    // ---- support card
    umdb.supportCard.forEach((card) => {
      const meta =
        supportCardMetaFile?.supportCardMeta?.[String(card.id ?? '')] ?? {};
      UMDB.supportCards[card.id!] = Object.assign(card, meta);
    });
    // ---- succession relation
    umdb.successionRelation.forEach((relation) => {
      UMDB.successionRelationMemberCharaIds[relation.relationType!] = new Set(
        relation.member.map((m) => m.charaId!),
      );
    });
    // ---- race instance
    umdb.raceInstance.forEach((race) => (UMDB.raceInstances[race.id!] = race));
    // ---- skills
    umdb.skill.forEach((skill) => (UMDB.skills[skill.id!] = skill));
    // ---- interesting races
    UMDB.interestingRaceInstances = _.sortedUniq(
      umdb.winsSaddle.flatMap((ws) => ws.raceInstanceId),
    ).map((id) => UMDB.raceInstances[id]);
    // ---- stories
    UMDB.stories = umdb.story.map((story) => {
      const o: Story = { id: story.id!, name: story.name! };
      const id = story.id!;

      if (
        (501000000 <= id && id < 510000000) ||
        (801000000 <= id && id < 810000000)
      ) {
        o.chara = UMDB.charas[Math.floor(id / 1000) % 10000];
      } else if (810000000 <= id && id < 840000000) {
        o.supportCard = UMDB.supportCards[Math.floor(id / 1000) % 100000];
      }
      return o;
    });
    // ---- live songs
    umdb.liveSong.forEach((song) => {
      if (song.id != null) {
        UMDB.liveSongs[song.id] = song;
      }
    });
  } catch (err) {
    console.error('[UMDB] ❌ Load error:', err);
  }
  log.info(`[UMDB] 📥 Loaded`);
}

export function handleDataLoad(ipcMain: Electron.IpcMain) {
  ipcMain.handle('get-asset-file', (_, relativeFilePath: string) => {
    const normalizedRelativePath = relativeFilePath.replace(/^[./\\]+/, '');
    const candidates = [
      path.join(ASSETS_PATH, normalizedRelativePath),
      path.join(APP_PATH, normalizedRelativePath),
      path.join(APP_PATH, 'dist', normalizedRelativePath),
      path.join(APP_PATH, 'web-assets', normalizedRelativePath),
      path.join(APP_PATH, 'dist', 'web-assets', normalizedRelativePath),
      path.join(process.cwd(), 'web-assets', normalizedRelativePath),
    ];
    const fullPath = candidates.find((candidate) => fs.existsSync(candidate));
    if (!fullPath) {
      return null;
    }
    const buffer = fs.readFileSync(fullPath);
    return `data:image/png;base64,${buffer.toString('base64')}`;
  });
  ipcMain.handle('umdb-get', () => {
    return UMDB;
  });
}
