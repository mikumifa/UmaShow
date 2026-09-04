import successionData from 'renderer/data/succession_data.json';

import type { Dashboard } from './types';

const G1_COMPATIBILITY_POINTS = 3;

type SuccessionData = {
  relationPoints: Record<string, number>;
  umas: Array<{
    id: number;
    relationTypes: number[];
  }>;
};

export type ParentCompatibilityPreview = {
  label: string;
  base: number;
  total: number;
  g1Details: Array<{
    label: string;
    count: number;
  }>;
};

const data = successionData as SuccessionData;
const umaById = new Map(data.umas.map((uma) => [uma.id, uma]));

function baseCharaId(value: unknown) {
  const id = Number(value) || 0;
  if (!id) return 0;
  if (umaById.has(id)) return id;
  return Number(String(id).slice(0, 4)) || 0;
}

function relationScore(...rawIds: number[]) {
  const ids = rawIds.map(baseCharaId);
  if (
    !ids.length ||
    ids.some((id) => !id) ||
    new Set(ids).size !== ids.length
  ) {
    return 0;
  }
  const relationSets = ids.map(
    (id) => new Set(umaById.get(id)?.relationTypes || []),
  );
  if (relationSets.some((set) => !set.size)) return 0;
  const shared = [...relationSets[0]].filter((type) =>
    relationSets.slice(1).every((set) => set.has(type)),
  );
  return shared.reduce(
    (total, type) => total + (data.relationPoints[String(type)] || 0),
    0,
  );
}

function detailedCommonG1Count(
  firstWinSaddleIds: number[] | undefined,
  secondWinSaddleIds: number[] | undefined,
  successionG1SaddleIds: Iterable<number>,
) {
  if (!firstWinSaddleIds?.length || !secondWinSaddleIds?.length) {
    return undefined;
  }
  const g1Ids = new Set(successionG1SaddleIds);
  if (!g1Ids.size) return undefined;
  const first = new Set(firstWinSaddleIds.filter((id) => g1Ids.has(id)));
  const second = new Set(secondWinSaddleIds.filter((id) => g1Ids.has(id)));
  return [...first].filter((id) => second.has(id)).length;
}

export function parentCompatibilityPreview(
  targetCharaId: number,
  candidate: Dashboard['parents'][number],
  otherParent: Dashboard['parents'][number] | undefined,
  successionG1SaddleIds: Iterable<number>,
): ParentCompatibilityPreview {
  const candidateId = baseCharaId(candidate.chara_id);
  const targetId = baseCharaId(targetCharaId);
  const g1Details: ParentCompatibilityPreview['g1Details'] = [];
  let base = relationScore(targetId, candidateId);

  if (otherParent) {
    base += relationScore(candidateId, otherParent.chara_id);
    const count = detailedCommonG1Count(
      candidate.win_saddle_ids,
      otherParent.win_saddle_ids,
      successionG1SaddleIds,
    );
    if (count !== undefined) {
      g1Details.push({ label: `和另一亲代 ${otherParent.name}`, count });
    }
  }

  candidate.ancestors.forEach((ancestor, index) => {
    base += relationScore(targetId, candidateId, ancestor.chara_id);
    const count = detailedCommonG1Count(
      candidate.win_saddle_ids,
      ancestor.win_saddle_ids,
      successionG1SaddleIds,
    );
    if (count !== undefined) {
      g1Details.push({
        label: `和祖辈 ${index + 1} ${ancestor.name}`,
        count,
      });
    }
  });

  return {
    label: '当前继承位',
    base,
    total:
      base +
      g1Details.reduce(
        (total, detail) => total + detail.count * G1_COMPATIBILITY_POINTS,
        0,
      ),
    g1Details,
  };
}

export function parentCompatibilityTitle(
  compatibility: ParentCompatibilityPreview,
) {
  return [
    `基础相性 ${compatibility.base}`,
    ...compatibility.g1Details.map(
      (detail) =>
        `${detail.label}的胜鞍：共同 G1 ${detail.count} 场 × ${G1_COMPATIBILITY_POINTS}`,
    ),
    `总计 ${compatibility.total}`,
  ].join('\n');
}
