import { useEffect, useRef } from 'react';

const SCROLLABLE_OVERFLOW_RE = /(auto|scroll|overlay)/;

function findScrollParent(element: HTMLElement | null): HTMLElement | null {
  if (typeof window === 'undefined') return null;
  let current = element?.parentElement ?? null;
  while (
    current &&
    current !== document.body &&
    current !== document.documentElement
  ) {
    const { overflowY } = window.getComputedStyle(current);
    if (SCROLLABLE_OVERFLOW_RE.test(overflowY)) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

export default function useScrollLoadMore({
  enabled,
  loading = false,
  onLoadMore,
  threshold = 320,
  itemCount = 0,
  resetKey = '',
}: {
  enabled: boolean;
  loading?: boolean;
  onLoadMore: () => void | Promise<void>;
  threshold?: number;
  itemCount?: number;
  resetKey?: string | number;
}) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const latestOnLoadMore = useRef(onLoadMore);
  latestOnLoadMore.current = onLoadMore;
  const triggeredTokenRef = useRef<string | null>(null);
  const triggerToken = `${resetKey}:${itemCount}`;

  useEffect(() => {
    if (!loading) {
      triggeredTokenRef.current = null;
    }
  }, [enabled, loading, triggerToken]);

  useEffect(() => {
    if (!enabled || loading) return undefined;
    const sentinel = sentinelRef.current;
    if (!sentinel) return undefined;

    const scrollRoot = findScrollParent(sentinel);

    const trigger = () => {
      if (triggeredTokenRef.current === triggerToken) return;
      triggeredTokenRef.current = triggerToken;
      void latestOnLoadMore.current();
    };

    const checkScrollDistance = () => {
      if (scrollRoot) {
        if (scrollRoot.clientHeight <= 0) return;
        const remaining =
          scrollRoot.scrollHeight -
          (scrollRoot.scrollTop + scrollRoot.clientHeight);
        if (remaining <= threshold) {
          trigger();
        }
        return;
      }
      if (typeof window === 'undefined') return;
      const doc = document.documentElement;
      if (window.innerHeight <= 0 || doc.scrollHeight <= 0) return;
      const remaining = doc.scrollHeight - (window.scrollY + window.innerHeight);
      if (remaining <= threshold) {
        trigger();
      }
    };

    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            trigger();
          }
        },
        {
          root: scrollRoot,
          rootMargin: `0px 0px ${threshold}px 0px`,
          threshold: 0,
        },
      );
      observer.observe(sentinel);
    }

    const scrollTarget: HTMLElement | Window = scrollRoot ?? window;
    scrollTarget.addEventListener('scroll', checkScrollDistance, {
      passive: true,
    });
    window.addEventListener('resize', checkScrollDistance, { passive: true });
    const frameId = window.requestAnimationFrame(checkScrollDistance);

    return () => {
      observer?.disconnect();
      scrollTarget.removeEventListener('scroll', checkScrollDistance);
      window.removeEventListener('resize', checkScrollDistance);
      window.cancelAnimationFrame(frameId);
    };
  }, [enabled, loading, threshold, triggerToken]);

  return sentinelRef;
}
