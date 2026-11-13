import type { Dispatch, SetStateAction } from 'react';
import type { ParentFactorFilter } from 'renderer/utils/parentFactorFilters';

export const PARENT_ATTRIBUTE_FACTORS = [
  { factor_group_id: 1, name: '速度' },
  { factor_group_id: 2, name: '耐力' },
  { factor_group_id: 3, name: '力量' },
  { factor_group_id: 4, name: '毅力' },
  { factor_group_id: 5, name: '智力' },
];
export const PARENT_APTITUDE_FACTOR_GROUPS = [
  {
    label: '场地',
    factors: [
      { factor_group_id: 11, name: '草地' },
      { factor_group_id: 12, name: '泥地' },
    ],
  },
  {
    label: '跑法',
    factors: [
      { factor_group_id: 21, name: '领跑' },
      { factor_group_id: 22, name: '跟前' },
      { factor_group_id: 23, name: '居中' },
      { factor_group_id: 24, name: '后追' },
    ],
  },
  {
    label: '距离',
    factors: [
      { factor_group_id: 31, name: '短距离' },
      { factor_group_id: 32, name: '英里' },
      { factor_group_id: 33, name: '中距离' },
      { factor_group_id: 34, name: '长距离' },
    ],
  },
];

export default function ParentFactorFilters({
  filters,
  setFilters,
}: {
  filters: ParentFactorFilter[];
  setFilters: Dispatch<SetStateAction<ParentFactorFilter[]>>;
}) {
  const groups = [
    { title: '属性', rows: [{ label: '', factors: PARENT_ATTRIBUTE_FACTORS }] },
    { title: '适应性', rows: PARENT_APTITUDE_FACTOR_GROUPS },
  ];
  return (
    <div className="autoResearchAdaptiveColumns grid gap-2">
      {groups.map((group) => (
        <section
          key={group.title}
          aria-label={`${group.title}因子筛选`}
          className="rounded-lg border border-slate-200 bg-white p-2"
        >
          <h4 className="mb-2 text-caption font-semibold text-slate-700">
            {group.title}
          </h4>
          <div className="space-y-2">
            {group.rows.map((row) => (
              <div
                key={row.label}
                className="flex flex-wrap items-center gap-1.5"
              >
                {row.label && (
                  <span className="w-9 text-caption font-medium text-slate-500">
                    {row.label}
                  </span>
                )}
                {row.factors.map((factor) => {
                  const selected = filters.find(
                    (item) => item.groupId === factor.factor_group_id,
                  );
                  return (
                    <div
                      key={factor.factor_group_id}
                      className="inline-flex max-w-full items-center gap-1"
                    >
                      <button
                        type="button"
                        aria-pressed={Boolean(selected)}
                        onClick={() =>
                          setFilters((current) =>
                            selected
                              ? current.filter(
                                  (item) =>
                                    item.groupId !== factor.factor_group_id,
                                )
                              : [
                                  ...current,
                                  {
                                    groupId: factor.factor_group_id,
                                    scope: 'lineage',
                                    minimumStars: 0,
                                  },
                                ],
                          )
                        }
                        className={`rounded-md border px-2.5 py-1 text-caption font-medium transition-colors ${selected ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200'}`}
                      >
                        {factor.name}
                      </button>
                      {selected && (
                        <select
                          aria-label={`${factor.name}星级`}
                          value={`${selected.scope}:${selected.minimumStars}`}
                          onChange={(event) => {
                            const [scope, stars] =
                              event.target.value.split(':');
                            setFilters((current) =>
                              current.map((item) =>
                                item.groupId === factor.factor_group_id
                                  ? {
                                      ...item,
                                      scope:
                                        scope as ParentFactorFilter['scope'],
                                      minimumStars: Number(stars),
                                    }
                                  : item,
                              ),
                            );
                          }}
                          className="min-h-8 min-w-0 rounded-md border border-indigo-200 bg-white px-2 py-1 text-caption text-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                        >
                          <option value="lineage:0">不限星级</option>
                          {[1, 2, 3].map((stars) => (
                            <option
                              key={`self:${stars}`}
                              value={`self:${stars}`}
                            >
                              本体至少 {stars} 星
                            </option>
                          ))}
                          {Array.from(
                            { length: 9 },
                            (_, index) => index + 1,
                          ).map((stars) => (
                            <option
                              key={`lineage:${stars}`}
                              value={`lineage:${stars}`}
                            >
                              至少 {stars} 星
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
