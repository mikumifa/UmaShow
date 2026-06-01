import type { VenusData } from 'types/gameTypes';
import { UMDB } from 'renderer/utils/umdb';

const NODE_SIZE = 38;
const LINE_HEIGHT = 12;
const HALF_NODE = NODE_SIZE / 2;
const TOP_BRANCH_LINE_WIDTH = NODE_SIZE * 5;
const MID_BRANCH_LINE_WIDTH = NODE_SIZE * 3;
const LEAF_BRANCH_LINE_WIDTH = NODE_SIZE * 2;

const formatSpiritAssetId = (spiritId: number) =>
  String(spiritId).padStart(2, '0');

const getFragmentIconPath = (spiritId: number) =>
  `./icons/venusCup/fragement/utx_ico_fragment_${formatSpiritAssetId(spiritId)}.png`;

const getSpiritIconPath = (spiritId: number) =>
  `./icons/venusCup/spirit/utx_ico_spirit_${formatSpiritAssetId(spiritId)}.png`;

const getLevelIconPath = (spiritId: number) => {
  if (spiritId === 9041) {
    return './icons/venusCup/utx_btn_venus_lv_01.png';
  }
  if (spiritId === 9042) {
    return './icons/venusCup/utx_btn_venus_lv_02.png';
  }
  return './icons/venusCup/utx_btn_venus_lv_00.png';
};

function TreeNode({
  filled,
  iconPath,
  kind,
}: {
  filled: boolean;
  iconPath?: string;
  kind: 'fragment' | 'spirit' | 'level';
}) {
  const innerSize = kind === 'level' ? 'h-9 w-9' : 'h-8 w-8';

  return (
    <div
      className={[
        'flex shrink-0 items-center justify-center border transition-all duration-200',
        filled
          ? 'border-rose-300 bg-white shadow-[inset_0_0_4px_rgba(0,0,0,0.05)]'
          : 'border-gray-200 bg-gray-50 opacity-40',
      ].join(' ')}
      style={{ width: NODE_SIZE, height: NODE_SIZE }}
    >
      <div
        className={[
          'flex items-center justify-center rounded-sm',
          innerSize,
          filled
            ? kind === 'fragment'
              ? 'bg-fuchsia-100'
              : kind === 'spirit'
                ? 'bg-sky-100'
                : 'bg-amber-100'
            : 'bg-gray-200',
        ].join(' ')}
      >
        {filled && iconPath ? (
          <img
            src={iconPath}
            alt={kind}
            className={
              kind === 'level'
                ? 'h-8 w-8 object-contain'
                : 'h-7 w-7 object-contain'
            }
          />
        ) : null}
      </div>
    </div>
  );
}

function TreeLines({
  width,
  height,
  activeLeft,
  activeRight,
}: {
  width: number;
  height: number;
  activeLeft: boolean;
  activeRight: boolean;
}) {
  return (
    <svg
      width={width}
      height={height}
      className="pointer-events-none overflow-visible"
    >
      <line
        x1={HALF_NODE}
        y1={0}
        x2={HALF_NODE}
        y2={height}
        stroke={activeLeft ? '#FB7185' : '#E5E7EB'}
        strokeWidth="2"
      />
      {width > HALF_NODE ? (
        <line
          x1={HALF_NODE}
          y1={0}
          x2={width - HALF_NODE}
          y2={height}
          stroke={activeRight ? '#818CF8' : '#E5E7EB'}
          strokeWidth="2"
        />
      ) : null}
    </svg>
  );
}

export default function VenusSpiritTree({
  spiritInfo,
  charaInfo,
}: {
  spiritInfo?: VenusData['spiritInfo'];
  charaInfo?: VenusData['charaInfo'];
}) {
  const spiritMap = new Map(
    (spiritInfo ?? []).map((item) => [item.spiritNum, item]),
  );
  const goddessList = [...(charaInfo ?? [])].sort(
    (left, right) => left.charaId - right.charaId,
  );
  const goddessSlots =
    goddessList.length > 0
      ? goddessList
      : Array.from<VenusData['charaInfo'][number] | undefined>({
          length: 3,
        });

  const fragmentSlots = [1, 2, 3, 4, 5, 6, 7, 8].map((num) =>
    spiritMap.get(num),
  );
  const spiritLayer2 = [9, 10, 11, 12].map((num) => spiritMap.get(num));
  const spiritLayer3 = [13, 14].map((num) => spiritMap.get(num));
  const levelNode = spiritMap.get(15);

  return (
    <div
      className="relative flex h-[214px] shrink-0 items-center overflow-hidden rounded-xl border border-rose-100 bg-cover bg-center bg-no-repeat p-3 shadow-sm"
      style={{
        backgroundImage:
          "url('./icons/venusCup/singlevenus_knowledgetable_bg_00.png')",
      }}
    >
      <div className="absolute inset-0 bg-white/50" />
      <div className="relative flex flex-col items-start">
        <div className="mb-1 flex w-full items-start gap-3">
          <TreeNode
            filled={!!levelNode}
            iconPath={
              levelNode ? getLevelIconPath(levelNode.spiritId) : undefined
            }
            kind="level"
          />
          <div className="flex min-w-0 flex-1 items-start justify-end gap-1">
            {goddessSlots.map((goddess, index) => {
              const iconUrl = goddess
                ? (UMDB.charas[goddess.charaId]?.iconUrl ?? '')
                : '';
              return (
                <div
                  key={goddess?.charaId ?? `empty-goddess-${index}`}
                  className="flex w-[46px] shrink-0 flex-col items-center"
                >
                  <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-white shadow-sm ring-2 ring-rose-100">
                    {iconUrl && goddess ? (
                      <img
                        src={iconUrl}
                        alt={UMDB.charaName(goddess.charaId)}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="text-[8px] font-bold text-gray-400">
                        ?
                      </div>
                    )}
                  </div>
                  <div className="-mt-2 rounded-full border border-amber-200 bg-white px-2 py-0.5 text-[8px] font-black leading-none text-amber-700 shadow-sm">
                    {goddess && goddess.venusLevel > 0
                      ? `Lv${goddess.venusLevel}`
                      : 'None'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ height: LINE_HEIGHT }}>
          <TreeLines
            width={TOP_BRANCH_LINE_WIDTH}
            height={LINE_HEIGHT}
            activeLeft={!!spiritLayer3[0]}
            activeRight={!!spiritLayer3[1]}
          />
        </div>

        <div className="flex gap-0">
          {spiritLayer3.map((row3Node, row3Index) => {
            const firstChild = spiritLayer2[row3Index * 2];
            const secondChild = spiritLayer2[row3Index * 2 + 1];

            return (
              <div key={`row3-${row3Index}`} className="flex flex-col">
                <TreeNode
                  filled={!!row3Node}
                  iconPath={
                    row3Node ? getSpiritIconPath(row3Node.spiritId) : undefined
                  }
                  kind="spirit"
                />
                <div style={{ height: LINE_HEIGHT }}>
                  <TreeLines
                    width={MID_BRANCH_LINE_WIDTH}
                    height={LINE_HEIGHT}
                    activeLeft={!!firstChild}
                    activeRight={!!secondChild}
                  />
                </div>

                <div className="flex gap-0">
                  {[firstChild, secondChild].map((row2Node, row2Index) => {
                    const firstFragment =
                      fragmentSlots[row3Index * 4 + row2Index * 2];
                    const secondFragment =
                      fragmentSlots[row3Index * 4 + row2Index * 2 + 1];

                    return (
                      <div
                        key={`row2-${row3Index}-${row2Index}`}
                        className="flex flex-col"
                      >
                        <TreeNode
                          filled={!!row2Node}
                          iconPath={
                            row2Node
                              ? getSpiritIconPath(row2Node.spiritId)
                              : undefined
                          }
                          kind="spirit"
                        />
                        <div style={{ height: LINE_HEIGHT }}>
                          <TreeLines
                            width={LEAF_BRANCH_LINE_WIDTH}
                            height={LINE_HEIGHT}
                            activeLeft={!!firstFragment}
                            activeRight={!!secondFragment}
                          />
                        </div>
                        <div className="flex gap-0">
                          {[firstFragment, secondFragment].map(
                            (fragmentNode, fragmentIndex) => (
                              <TreeNode
                                key={`fragment-${row3Index}-${row2Index}-${fragmentIndex}`}
                                filled={!!fragmentNode}
                                iconPath={
                                  fragmentNode
                                    ? getFragmentIconPath(fragmentNode.spiritId)
                                    : undefined
                                }
                                kind="fragment"
                              />
                            ),
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
