import { RaceInstance, Skill, SupportCard } from 'umdb/data_pb';

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
  get supportCards(): Record<number, SupportCard> {
    return umdbInstance?.supportCards ?? {};
  },
  get cards() {
    return umdbInstance?.cards ?? {};
  },
  get skills(): Record<number, Skill> {
    return umdbInstance?.skills ?? {};
  },

  charaName(id: number) {
    return umdbInstance?.charas[id]?.name ?? 'Unknown Chara';
  },
  cardName(id: number) {
    return umdbInstance?.cards[id]?.name ?? 'Unknown Card';
  },
  skillName(id: number) {
    return umdbInstance?.skills[id]?.name ?? 'Unknown Skill';
  },
};
