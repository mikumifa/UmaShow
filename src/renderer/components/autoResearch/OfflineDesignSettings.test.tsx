import { fireEvent, render, waitFor } from '@testing-library/react';
import * as designModel from 'renderer/utils/offlineCareerDesign';
import { PLANNER_CATALOG } from 'renderer/utils/racePlannerCatalog';
import OfflineDesignSettings from './OfflineDesignSettings';
import type { Dashboard } from './types';
import * as shared from './shared';

type Parent = Dashboard['parents'][number];
const own1 = { selection_id: 'own:0:1', source: 'own', viewer_id: 0 } as Parent;
const own2 = { selection_id: 'own:0:2', source: 'own', viewer_id: 0 } as Parent;
const rental = {
  selection_id: 'rental:123:3',
  source: 'rental',
  viewer_id: 123,
} as Parent;
const mismatched = {
  selection_id: 'rental:456:4',
  source: 'own',
  viewer_id: 0,
} as Parent;

afterEach(() => jest.restoreAllMocks());

test.each([true, false])(
  'one-click applies only own parents and clears an existing rental when no own pair is found (%s)',
  async (hasPair) => {
    jest
      .spyOn(shared, 'getSharedStorageItem')
      .mockReturnValue('{"version":2,"fanBonus":80}');
    const runDesign = jest
      .spyOn(designModel, 'designOfflineCareer')
      .mockReturnValue({
        best: hasPair ? { parents: [own1, own2] } : undefined,
        demands: [],
        schedule: { raceCount: 1, expectedDrops: 0.05, expectedFans: 100 },
        raceIds: [],
        notes: [],
      } as unknown as ReturnType<typeof designModel.designOfflineCareer>);
    const setParents = jest.fn();
    const { getByRole } = render(
      <OfflineDesignSettings
        design={designModel.normalizeOfflineDesign({ goal: 'jewels' })}
        setDesign={jest.fn()}
        charaId={PLANNER_CATALOG.characters[0].id}
        changeScenario={jest.fn()}
        parents={[own1, own2, rental, mismatched]}
        selectedParent1={rental.selection_id}
        selectedParent2={own1.selection_id}
        setParents={setParents}
        busy=""
      />,
    );
    fireEvent.click(getByRole('button', { name: '一键设计' }));
    await waitFor(() =>
      expect(setParents).toHaveBeenCalledWith(
        hasPair ? own1.selection_id : '',
        hasPair ? own2.selection_id : '',
      ),
    );
    expect(runDesign.mock.calls[0][2]).toEqual([own1, own2]);
    expect(runDesign.mock.calls[0][3]).toBe(80);
  },
);
