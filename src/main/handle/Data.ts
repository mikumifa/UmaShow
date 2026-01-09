import fs from 'fs';
import path from 'path';
import log from 'electron-log';
import _ from 'lodash';
import { ASSETS_PATH } from 'main/paths';
import pako from 'pako';
import {
  Card,
  Chara,
  LiveSong,
  RaceInstance,
  Skill,
  SupportCard,
  UMDatabase,
} from 'umdb/data_pb';
import { Story } from 'umdb/UMDatabaseUtils';

export const UMDB = {
  charas: {} as Record<number, Chara>,
  cards: {} as Record<number, Card>,
  supportCards: {} as Record<number, SupportCard>,
  liveSongs: {} as Record<number, LiveSong>,
  successionRelationMemberCharaIds: {} as Record<number, Set<number>>,
  raceInstances: {} as Record<number, RaceInstance>,
  skills: {} as Record<number, Skill>,
  interestingRaceInstances: [] as RaceInstance[],
  stories: [] as Story[],
};

export function UMDBload() {
  try {
    const filePath = path.join(ASSETS_PATH, 'data', 'umdb.binarypb.gz');
    if (!fs.existsSync(filePath)) {
      log.error(`[UMDB] ❌ DB file not found: ${filePath}`);
      return;
    }
    const gzData = fs.readFileSync(filePath);
    const inflated = pako.inflate(gzData);
    const umdb = UMDatabase.fromBinary(inflated);
    // ---- chara
    umdb.chara.forEach((c) => (UMDB.charas[c.id!] = c));
    // ---- card
    umdb.card.forEach((card) => (UMDB.cards[card.id!] = card));
    // ---- support card
    umdb.supportCard.forEach((card) => (UMDB.supportCards[card.id!] = card));
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
    const fullPath = path.join(ASSETS_PATH, relativeFilePath);
    if (!fs.existsSync(fullPath)) {
      return null;
    }
    const buffer = fs.readFileSync(fullPath);
    return `data:image/png;base64,${buffer.toString('base64')}`;
  });
  ipcMain.handle('umdb-get', () => {
    return UMDB;
  });
}
