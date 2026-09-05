import { LiveSong, RaceInstance, Skill } from 'umdb/data_pb';
import type { SupportCardWithMeta } from 'types/supportCard';

let umdbInstance: any = null;
let loadPromise: Promise<any> | null = null;

export function loadUMDB() {
  if (!loadPromise) {
    loadPromise = window.electron.utils.getUmaDatabase().then((db) => {
      umdbInstance = db;
      return db;
    });
  }
  return loadPromise;
}

export const UMDB = {
  get data() {
    return umdbInstance;
  },

  get charas() {
    return umdbInstance?.charas ?? {};
  },
  get raceInstances(): Record<number, RaceInstance> {
    return umdbInstance?.raceInstances ?? {};
  },
  get supportCards(): Record<number, SupportCardWithMeta> {
    return umdbInstance?.supportCards ?? {};
  },
  get cardRarityData(): Record<number, Record<number, number>> {
    return umdbInstance?.cardRarityData ?? {};
  },
  get arcRivalDressIds(): Record<number, number> {
    return umdbInstance?.arcRivalDressIds ?? {};
  },
  get cardTalentRates(): Record<
    number,
    { speed: number; stamina: number; power: number; guts: number; wiz: number }
  > {
    return umdbInstance?.cardTalentRates ?? {};
  },
  get supportCardLevels(): Record<string, Record<string, number>> {
    return umdbInstance?.supportCardLevels ?? {};
  },
  get supportCardEffectTypes(): Record<string, string> {
    return umdbInstance?.supportCardEffectTypes ?? {};
  },
  get cards() {
    return umdbInstance?.cards ?? {};
  },
  get skills(): Record<number, Skill> {
    return umdbInstance?.skills ?? {};
  },
  get liveSongs(): Record<number, LiveSong> {
    return umdbInstance?.liveSongs ?? {};
  },
  get charaEffectTexts(): Record<number, string> {
    return umdbInstance?.charaEffectTexts ?? {};
  },
  get skillTipNames(): Record<number, Record<number, string>> {
    return umdbInstance?.skillTipNames ?? {};
  },
  get stories() {
    return umdbInstance?.stories ?? [];
  },
  get successionG1SaddleIds(): number[] {
    return umdbInstance?.successionG1SaddleIds ?? [];
  },
  get successionFactorMeta(): Record<
    number,
    {
      id: number;
      groupId: number;
      stars: 1 | 2 | 3;
      factorType: 3 | 4 | 5;
      name: string;
      skillGroupIds: number[];
      skillTargets: Array<{
        groupId: number;
        name: string;
        iconId: number;
        level?: number;
      }>;
    }
  > {
    return umdbInstance?.successionFactorMeta ?? {};
  },

  charaName(id: number) {
    return umdbInstance?.charas[id]?.name ?? 'Unknown Chara';
  },
  charaIconPath(id: number) {
    return id === 9043
      ? './icons/chara/chr_icon_training_9043.png'
      : (umdbInstance?.charas[id]?.iconUrl ?? '');
  },
  arcRivalIconPath(charaId: number) {
    let raceDressId = umdbInstance?.arcRivalDressIds?.[charaId];

    // Keep older generated databases compatible by deriving the first
    // playable costume from card_rarity_data.
    if (!raceDressId) {
      const cardId = Object.keys(umdbInstance?.cardRarityData ?? {})
        .map(Number)
        .filter((id) => Math.floor(id / 100) === charaId)
        .sort((left, right) => left - right)[0];
      raceDressId = umdbInstance?.cardRarityData?.[cardId]?.[3];
    }

    return raceDressId
      ? `trained_chr_icon/${charaId}_${raceDressId}.png`
      : this.charaIconPath(charaId);
  },
  cardName(id: number) {
    return umdbInstance?.cards[id]?.name ?? 'Unknown Card';
  },
  skillName(id: number) {
    return umdbInstance?.skills[id]?.name ?? 'Unknown Skill';
  },
  skillTipName(groupId: number, rarity?: number) {
    if (rarity != null) {
      const skillId = Number(`${groupId}${rarity}`);
      const skillName = umdbInstance?.skills?.[skillId]?.name;
      if (skillName) {
        return skillName;
      }
    }
    const rarityMap = umdbInstance?.skillTipNames?.[groupId];
    if (!rarityMap) return `技能组 ${groupId}`;
    if (rarity != null && rarityMap[rarity]) {
      return rarityMap[rarity];
    }
    const firstName = Object.values(rarityMap)[0];
    return firstName ?? `技能组 ${groupId}`;
  },
};
