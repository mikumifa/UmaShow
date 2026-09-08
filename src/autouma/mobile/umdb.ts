import _ from 'lodash';
import pako from 'pako';
import {
  UMDatabase,
  WinsSaddle_WinSaddleType,
} from 'umdb/data_pb';
import type { SupportCardMetaFile } from 'types/supportCard';
import { UMDB } from 'main/handle/Data';

let loadPromise: Promise<typeof UMDB> | null = null;

function bundledUrl(path: string) {
  return new URL(path, document.baseURI).toString();
}

async function fetchRequired(path: string) {
  const response = await fetch(bundledUrl(path));
  if (!response.ok) {
    throw new Error(`无法读取 AutoUma 内置资源 ${path}：HTTP ${response.status}`);
  }
  return response;
}

export function loadMobileUmaDatabase() {
  if (loadPromise) return loadPromise;
  loadPromise = Promise.all([
    fetchRequired('data/umdb.binarypb.gz').then((response) =>
      response.arrayBuffer(),
    ),
    fetchRequired('data/umdb.json').then((response) => response.json()),
    fetchRequired('data/support_card_meta.json').then((response) =>
      response.json(),
    ),
    fetchRequired('data/succession_factor_meta.json').then((response) =>
      response.json(),
    ),
  ]).then(([binary, rawJson, rawSupportMeta, rawFactorMeta]) => {
    const database = UMDatabase.fromBinary(
      pako.inflate(new Uint8Array(binary)),
    );
    const umdbJson = rawJson as {
      charaEffectTexts?: Record<string, string>;
      skillTipNames?: Record<string, Record<string, string>>;
      cardRarityData?: Record<string, Record<string, number>>;
      arcRivalDressIds?: Record<string, number>;
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
    const supportMeta = rawSupportMeta as SupportCardMetaFile;
    const factorMeta = rawFactorMeta as Record<string, any>;

    UMDB.charas = {};
    UMDB.cards = {};
    UMDB.supportCards = {};
    UMDB.raceInstances = {};
    UMDB.skills = {};
    UMDB.liveSongs = {};
    UMDB.successionRelationMemberCharaIds = {};
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
    UMDB.arcRivalDressIds = Object.fromEntries(
      Object.entries(umdbJson.arcRivalDressIds ?? {}).map(
        ([charaId, raceDressId]) => [Number(charaId), Number(raceDressId)],
      ),
    );
    UMDB.cardTalentRates = Object.fromEntries(
      Object.entries(umdbJson.cardTalentRates ?? {}).map(([cardId, rates]) => [
        Number(cardId),
        {
          speed: Number(rates.speed ?? 0),
          stamina: Number(rates.stamina ?? 0),
          power: Number(rates.power ?? 0),
          guts: Number(rates.guts ?? 0),
          wiz: Number(rates.wiz ?? 0),
        },
      ]),
    );
    UMDB.supportCardLevels = supportMeta.supportCardLevels ?? {};
    UMDB.supportCardEffectTypes = supportMeta.supportCardEffectTypes ?? {};
    UMDB.successionFactorMeta = Object.fromEntries(
      Object.entries(factorMeta).map(([factorId, factor]) => [
        Number(factorId),
        {
          ...factor,
          id: Number(factor.id || factorId),
          groupId: Number(factor.groupId || 0),
          skillGroupIds: (factor.skillGroupIds || []).map(Number),
          skillTargets: (factor.skillTargets || []).flatMap((target: any) => {
            const groupId = Number(target.groupId || 0);
            return groupId
              ? [
                  {
                    groupId,
                    name: String(target.name || `技能组 ${groupId}`),
                    iconId: Number(target.iconId || 0),
                    level: Number(target.level || 0),
                  },
                ]
              : [];
          }),
        },
      ]),
    );

    database.chara.forEach((chara) => {
      UMDB.charas[chara.id!] = chara;
    });
    database.card.forEach((card) => {
      UMDB.cards[card.id!] = card;
    });
    database.supportCard.forEach((card) => {
      const meta =
        supportMeta.supportCardMeta?.[String(card.id ?? '')] ?? {};
      UMDB.supportCards[card.id!] = Object.assign(card, meta);
    });
    database.successionRelation.forEach((relation) => {
      UMDB.successionRelationMemberCharaIds[relation.relationType!] = new Set(
        relation.member.map((member) => member.charaId!),
      );
    });
    database.raceInstance.forEach((race) => {
      UMDB.raceInstances[race.id!] = race;
    });
    database.skill.forEach((skill) => {
      UMDB.skills[skill.id!] = skill;
    });
    UMDB.interestingRaceInstances = _.sortedUniq(
      database.winsSaddle.flatMap((saddle) => saddle.raceInstanceId),
    ).map((id) => UMDB.raceInstances[id]);
    UMDB.successionG1SaddleIds = database.winsSaddle
      .filter((saddle) => saddle.type === WinsSaddle_WinSaddleType.G1)
      .map((saddle) => Number(saddle.id || 0))
      .filter((id) => id > 0);
    UMDB.stories = database.story.map((story) => {
      const value: any = { id: story.id!, name: story.name! };
      const id = story.id!;
      if (
        (id >= 501000000 && id < 510000000) ||
        (id >= 801000000 && id < 810000000)
      ) {
        value.chara = UMDB.charas[Math.floor(id / 1000) % 10000];
      } else if (id >= 810000000 && id < 840000000) {
        value.supportCard = UMDB.supportCards[Math.floor(id / 1000) % 100000];
      }
      return value;
    });
    database.liveSong.forEach((song) => {
      if (song.id != null) UMDB.liveSongs[song.id] = song;
    });
    return UMDB;
  });
  return loadPromise;
}

export { UMDB };
