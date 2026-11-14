import { useCallback, useEffect, useRef, useState } from 'react';
import { CareerSessionRecord } from './types';

export type HistoryView = 'day' | 'task';
export type AssetMetric =
  | 'jewels'
  | 'support_tickets'
  | 'character_tickets'
  | 'energy_drinks';

export type PageInfo = { has_more: boolean; next_offset: number | null };
export type HistoryPage = PageInfo & { reports: CareerSessionRecord[] };
export type AssetTrackingRow = {
  business_day: string;
  captured_at: string;
  value: number;
  delta: number | null;
};
export type TrackingPage = PageInfo & { rows: AssetTrackingRow[] };
export type LoadHistoryPage = (
  view: HistoryView,
  offset: number,
) => Promise<HistoryPage>;
export type LoadTrackingPage = (
  metric: AssetMetric,
  offset: number,
) => Promise<TrackingPage>;

type Page<T> = {
  rows: T[];
  nextOffset: number | null;
  loading: boolean;
  error: string;
};

/** Each tab owns a page cache; stale account/refresh responses are ignored. */
export default function useHistoryPages<K extends string, T>({
  scope,
  activeKey,
  enabled,
  refreshRevision,
  load,
  identify,
}: {
  scope: string;
  activeKey: K;
  enabled: boolean;
  refreshRevision: string | number;
  load: (key: K, offset: number) => Promise<PageInfo & { rows: T[] }>;
  identify: (row: T) => string;
}) {
  const cache = useRef<Partial<Record<K, Page<T>>>>({});
  const generation = useRef(0);
  const latest = useRef({ load, identify });
  latest.current = { load, identify };
  const [, redraw] = useState(0);

  const fetchPage = useCallback(async (key: K, reset = false) => {
    const previous = cache.current[key];
    if (previous?.loading) return;
    const offset = reset ? 0 : (previous?.nextOffset ?? 0);
    if (!reset && previous && previous.nextOffset === null) return;
    const ticket = generation.current;
    const page: Page<T> = {
      rows: previous?.rows || [],
      nextOffset: offset,
      loading: true,
      error: '',
    };
    cache.current[key] = page;
    redraw((value) => value + 1);
    try {
      const result = await latest.current.load(key, offset);
      if (ticket !== generation.current) return;
      const merged = new Map(
        (offset === 0 ? [] : page.rows).map((row) => [
          latest.current.identify(row),
          row,
        ]),
      );
      result.rows.forEach((row) =>
        merged.set(latest.current.identify(row), row),
      );
      cache.current[key] = {
        rows: [...merged.values()],
        nextOffset:
          result.has_more &&
          result.next_offset !== null &&
          result.next_offset !== offset
            ? result.next_offset
            : null,
        loading: false,
        error: '',
      };
    } catch (caught) {
      if (ticket !== generation.current) return;
      cache.current[key] = {
        ...page,
        loading: false,
        error: String((caught as Error)?.message || caught),
      };
    } finally {
      if (ticket === generation.current) redraw((value) => value + 1);
    }
  }, []);

  useEffect(() => {
    generation.current += 1;
    cache.current = {};
    redraw((value) => value + 1);
    return () => {
      generation.current += 1;
    };
  }, [scope, refreshRevision]);

  useEffect(() => {
    if (enabled && scope && !cache.current[activeKey])
      void fetchPage(activeKey);
  }, [scope, refreshRevision, activeKey, enabled, fetchPage]);

  const loadMore = useCallback(
    () => fetchPage(activeKey),
    [activeKey, fetchPage],
  );
  const refresh = useCallback(
    () => fetchPage(activeKey, true),
    [activeKey, fetchPage],
  );

  const page = cache.current[activeKey];
  return {
    rows: page?.rows || [],
    loading: Boolean(enabled && scope && (!page || page.loading)),
    error: page?.error || '',
    hasMore: page?.nextOffset != null,
    loadMore,
    refresh,
  };
}
