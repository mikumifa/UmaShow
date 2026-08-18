import type { BrowserWindow, IpcMain } from 'electron';

export type SuccessionIndexSnapshot = {
  receivedAt: string;
  data: Record<string, any>;
};

let latestSnapshot: SuccessionIndexSnapshot | null = null;

type SuccessionCaptureParts = {
  trained_chara?: any[];
  trained_chara_array?: any[];
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
      if (!found.trained_chara && hasDetailedTrainedRows(directOwnRows)) {
        found.trained_chara = directOwnRows;
      }
      if (
        !found.trained_chara_array &&
        hasDetailedTrainedRows(fallbackOwnRows)
      ) {
        found.trained_chara_array = fallbackOwnRows;
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

function preferIncomingArray(current: unknown, incoming: unknown) {
  if (!Array.isArray(incoming)) return current;
  if (incoming.length || !Array.isArray(current)) return incoming;
  return current;
}

function mergeRentalData(
  current: Record<string, any> | undefined,
  incoming: Record<string, any> | undefined,
) {
  if (!incoming) return current;
  if (!current) return incoming;
  return {
    ...current,
    ...incoming,
    succession_trained_chara_array: preferIncomingArray(
      current.succession_trained_chara_array,
      incoming.succession_trained_chara_array,
    ),
    summary_user_info_array: preferIncomingArray(
      current.summary_user_info_array,
      incoming.summary_user_info_array,
    ),
  };
}

export function captureSuccessionIndex(
  decodedData: unknown,
  mainWindow: BrowserWindow,
) {
  const captured = findSuccessionParts(decodedData);
  if (
    !captured.trained_chara &&
    !captured.trained_chara_array &&
    !captured.succession_trained_chara_data
  ) {
    return false;
  }

  const current = latestSnapshot?.data || {};

  latestSnapshot = {
    receivedAt: new Date().toISOString(),
    data: {
      trained_chara: preferIncomingArray(
        current.trained_chara,
        captured.trained_chara,
      ),
      trained_chara_array: preferIncomingArray(
        current.trained_chara_array,
        captured.trained_chara_array,
      ),
      succession_trained_chara_data: mergeRentalData(
        current.succession_trained_chara_data,
        captured.succession_trained_chara_data,
      ),
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
