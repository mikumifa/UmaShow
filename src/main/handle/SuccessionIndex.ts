import type { BrowserWindow, IpcMain } from 'electron';

export type SuccessionIndexSnapshot = {
  receivedAt: string;
  viewerId?: number;
  data: Record<string, any>;
};

let latestSnapshot: SuccessionIndexSnapshot | null = null;

type SuccessionCaptureParts = {
  own?: {
    field: 'trained_chara' | 'trained_chara_array';
    rows: any[];
  };
  succession_trained_chara_data?: Record<string, any>;
};

function hasDetailedTrainedRows(rows: unknown) {
  return (
    Array.isArray(rows) &&
    rows.some(
      (row) =>
        Array.isArray(row?.factor_info_array) ||
        Array.isArray(row?.succession_chara_array),
    )
  );
}

function looksLikeRentalData(value: unknown): value is Record<string, any> {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, any>;
  return (
    Array.isArray(data.succession_trained_chara_array) ||
    Array.isArray(data.summary_user_info_array)
  );
}

function looksLikeEmptyOwnIndexRows(
  container: Record<string, any>,
  rows: unknown,
) {
  return (
    Array.isArray(rows) &&
    rows.length === 0 &&
    (Array.isArray(container.card_list) ||
      looksLikeRentalData(container.succession_trained_chara_data))
  );
}

function findSuccessionParts(decodedData: unknown) {
  const queue: unknown[] = [decodedData];
  const visited = new Set<object>();
  const found: SuccessionCaptureParts = {};

  while (queue.length) {
    const current = queue.shift();
    if (current && typeof current === 'object' && !visited.has(current)) {
      visited.add(current);

      const value = current as Record<string, any>;
      const directOwnRows = value.trained_chara;
      const fallbackOwnRows = value.trained_chara_array;
      if (!found.own && Array.isArray(directOwnRows)) {
        found.own = { field: 'trained_chara', rows: directOwnRows };
      }
      if (
        !found.own &&
        (hasDetailedTrainedRows(fallbackOwnRows) ||
          looksLikeEmptyOwnIndexRows(value, fallbackOwnRows))
      ) {
        found.own = {
          field: 'trained_chara_array',
          rows: fallbackOwnRows,
        };
      }

      const rentalData = value.succession_trained_chara_data;
      if (
        !found.succession_trained_chara_data &&
        looksLikeRentalData(rentalData)
      ) {
        found.succession_trained_chara_data = rentalData;
      }

      Object.values(value).forEach((child) => {
        if (child && typeof child === 'object') queue.push(child);
      });
    }
  }

  return found;
}

function findResponseViewerId(decodedData: unknown) {
  const queue: unknown[] = [decodedData];
  const visited = new Set<object>();
  while (queue.length) {
    const current = queue.shift();
    if (current && typeof current === 'object' && !visited.has(current)) {
      visited.add(current);
      const value = current as Record<string, any>;
      const viewerId = Number(value.data_headers?.viewer_id || 0);
      if (viewerId) return viewerId;
      Object.values(value).forEach((child) => {
        if (child && typeof child === 'object') queue.push(child);
      });
    }
  }
  return 0;
}

export function captureSuccessionIndex(
  decodedData: unknown,
  mainWindow: BrowserWindow,
) {
  const captured = findSuccessionParts(decodedData);
  if (!captured.own && !captured.succession_trained_chara_data) {
    return false;
  }

  const current = latestSnapshot?.data || {};
  const ownData = captured.own
    ? {
        trained_chara:
          captured.own.field === 'trained_chara'
            ? captured.own.rows
            : undefined,
        trained_chara_array:
          captured.own.field === 'trained_chara_array'
            ? captured.own.rows
            : undefined,
      }
    : {
        trained_chara: current.trained_chara,
        trained_chara_array: current.trained_chara_array,
      };

  latestSnapshot = {
    receivedAt: new Date().toISOString(),
    viewerId: findResponseViewerId(decodedData) || latestSnapshot?.viewerId,
    data: {
      ...ownData,
      succession_trained_chara_data:
        captured.succession_trained_chara_data ??
        current.succession_trained_chara_data,
    },
  };
  mainWindow.webContents.send('succession-index:update', latestSnapshot);
  return true;
}

export function handleSuccessionIndex(ipcMain: IpcMain) {
  ipcMain.handle('succession-index:get', () => latestSnapshot);
}

export function resetSuccessionIndexForTests() {
  latestSnapshot = null;
}
