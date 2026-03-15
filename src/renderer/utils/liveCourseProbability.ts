type NoteKey = 'da' | 'pa' | 'vo' | 'vi' | 'me';

export type NoteInventory = Record<NoteKey, number>;
export type DoubleLessonYear = 1 | 2 | 3;

interface DoubleLessonCost {
  id: number;
  notes: NoteInventory;
}

const emptyInventory = (): NoteInventory => ({
  da: 0,
  pa: 0,
  vo: 0,
  vi: 0,
  me: 0,
});

const createInventory = (
  patch: Partial<NoteInventory>,
): NoteInventory => ({
  ...emptyInventory(),
  ...patch,
});

const DOUBLE_LESSON_POOL_BY_YEAR: Record<
  DoubleLessonYear,
  DoubleLessonCost[]
> = {
  1: [
    { id: 13001, notes: createInventory({ da: 8, pa: 8 }) },
    { id: 13002, notes: createInventory({ da: 8, vo: 8 }) },
    { id: 13003, notes: createInventory({ da: 8, vi: 8 }) },
    { id: 13004, notes: createInventory({ da: 8, me: 8 }) },
    { id: 13005, notes: createInventory({ da: 10, vi: 6 }) },
    { id: 13006, notes: createInventory({ pa: 8, vo: 8 }) },
    { id: 13007, notes: createInventory({ pa: 8, vi: 8 }) },
    { id: 13008, notes: createInventory({ pa: 8, me: 8 }) },
    { id: 13009, notes: createInventory({ pa: 10, vo: 6 }) },
    { id: 13010, notes: createInventory({ vo: 8, vi: 8 }) },
    { id: 13011, notes: createInventory({ vo: 8, me: 8 }) },
    { id: 13012, notes: createInventory({ vo: 10, me: 6 }) },
    { id: 13013, notes: createInventory({ vi: 8, me: 8 }) },
    { id: 13014, notes: createInventory({ da: 6, vi: 10 }) },
    { id: 13015, notes: createInventory({ pa: 6, me: 10 }) },
  ],
  2: [
    { id: 13101, notes: createInventory({ da: 12, pa: 12 }) },
    { id: 13102, notes: createInventory({ da: 12, vo: 12 }) },
    { id: 13103, notes: createInventory({ da: 12, vi: 12 }) },
    { id: 13104, notes: createInventory({ da: 12, me: 12 }) },
    { id: 13105, notes: createInventory({ da: 14, vi: 10 }) },
    { id: 13106, notes: createInventory({ pa: 12, vo: 12 }) },
    { id: 13107, notes: createInventory({ pa: 12, vi: 12 }) },
    { id: 13108, notes: createInventory({ pa: 12, me: 12 }) },
    { id: 13109, notes: createInventory({ pa: 14, vo: 10 }) },
    { id: 13110, notes: createInventory({ vo: 12, vi: 12 }) },
    { id: 13111, notes: createInventory({ vo: 12, me: 12 }) },
    { id: 13112, notes: createInventory({ vo: 14, me: 10 }) },
    { id: 13113, notes: createInventory({ vi: 12, me: 12 }) },
    { id: 13114, notes: createInventory({ da: 10, vi: 14 }) },
    { id: 13115, notes: createInventory({ pa: 10, me: 14 }) },
  ],
  3: [
    { id: 13201, notes: createInventory({ da: 16, pa: 16 }) },
    { id: 13202, notes: createInventory({ da: 16, vo: 16 }) },
    { id: 13203, notes: createInventory({ da: 16, vi: 16 }) },
    { id: 13204, notes: createInventory({ da: 16, me: 16 }) },
    { id: 13205, notes: createInventory({ da: 20, vi: 12 }) },
    { id: 13206, notes: createInventory({ pa: 16, vo: 16 }) },
    { id: 13207, notes: createInventory({ pa: 16, vi: 16 }) },
    { id: 13208, notes: createInventory({ pa: 16, me: 16 }) },
    { id: 13209, notes: createInventory({ pa: 20, vo: 12 }) },
    { id: 13210, notes: createInventory({ vo: 16, vi: 16 }) },
    { id: 13211, notes: createInventory({ vo: 16, me: 16 }) },
    { id: 13212, notes: createInventory({ vo: 20, me: 12 }) },
    { id: 13213, notes: createInventory({ vi: 16, me: 16 }) },
    { id: 13214, notes: createInventory({ da: 12, vi: 20 }) },
    { id: 13215, notes: createInventory({ pa: 12, me: 20 }) },
  ],
};

const NOTE_KEYS: NoteKey[] = ['da', 'pa', 'vo', 'vi', 'me'];

const canAfford = (inventory: NoteInventory, cost: NoteInventory) =>
  NOTE_KEYS.every((key) => inventory[key] >= cost[key]);

const subtractCost = (
  inventory: NoteInventory,
  cost: NoteInventory,
): NoteInventory =>
  createInventory({
    da: inventory.da - cost.da,
    pa: inventory.pa - cost.pa,
    vo: inventory.vo - cost.vo,
    vi: inventory.vi - cost.vi,
    me: inventory.me - cost.me,
  });

const serializeInventory = (inventory: NoteInventory) =>
  NOTE_KEYS.map((key) => inventory[key]).join(',');

export function getDoubleLessonPool(year: DoubleLessonYear) {
  return DOUBLE_LESSON_POOL_BY_YEAR[year];
}

export function getDoubleLessonPurchaseProbability({
  inventory,
  purchaseCount,
  year,
}: {
  inventory: NoteInventory;
  purchaseCount: number;
  year: DoubleLessonYear;
}) {
  if (purchaseCount <= 0) {
    return 1;
  }

  const pool = DOUBLE_LESSON_POOL_BY_YEAR[year];
  if (pool.length === 0) {
    return 0;
  }

  let states = new Map<string, { inventory: NoteInventory; probability: number }>(
    [[serializeInventory(inventory), { inventory, probability: 1 }]],
  );

  for (let i = 0; i < purchaseCount; i += 1) {
    const nextStates = new Map<
      string,
      { inventory: NoteInventory; probability: number }
    >();

    states.forEach((state) => {
      pool.forEach((lesson) => {
        if (!canAfford(state.inventory, lesson.notes)) {
          return;
        }

        const nextInventory = subtractCost(state.inventory, lesson.notes);
        const key = serializeInventory(nextInventory);
        const nextProbability = state.probability / pool.length;
        const existing = nextStates.get(key);

        if (existing) {
          existing.probability += nextProbability;
          return;
        }

        nextStates.set(key, {
          inventory: nextInventory,
          probability: nextProbability,
        });
      });
    });

    states = nextStates;
    if (states.size === 0) {
      return 0;
    }
  }

  let probability = 0;
  states.forEach((state) => {
    probability += state.probability;
  });
  return probability;
}

export function getLessonPurchaseProbabilityAfterCurrent({
  inventory,
  currentLessonCost,
  totalPurchaseCount,
  year,
}: {
  inventory: NoteInventory;
  currentLessonCost: NoteInventory;
  totalPurchaseCount: number;
  year: DoubleLessonYear;
}) {
  if (totalPurchaseCount <= 0) {
    return 1;
  }

  if (!canAfford(inventory, currentLessonCost)) {
    return 0;
  }

  if (totalPurchaseCount === 1) {
    return 1;
  }

  return getDoubleLessonPurchaseProbability({
    inventory: subtractCost(inventory, currentLessonCost),
    purchaseCount: totalPurchaseCount - 1,
    year,
  });
}
