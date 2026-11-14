import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
export const MOTION_EXIT_MS = 120;

export function prefersReducedMotion() {
  return window.matchMedia?.(REDUCED_MOTION_QUERY).matches ?? false;
}

export function shouldAnimateUI() {
  return (
    !prefersReducedMotion() &&
    !document.hidden &&
    document.documentElement.dataset.umaInput !== 'keyboard'
  );
}

export function motionScrollBehavior(): ScrollBehavior {
  return shouldAnimateUI() ? 'smooth' : 'auto';
}

function subscribeToMotionPreference(onChange: () => void) {
  const query = window.matchMedia?.(REDUCED_MOTION_QUERY);
  query?.addEventListener('change', onChange);
  return () => query?.removeEventListener('change', onChange);
}

export function useReducedMotion() {
  return useSyncExternalStore(subscribeToMotionPreference, prefersReducedMotion, () => true);
}

/** Share input modality with portalled dialogs as well as both app shells. */
export function useAppMotion() {
  useEffect(() => {
    const root = document.documentElement;
    const previousInput = root.dataset.umaInput;
    const previousBackground = root.dataset.umaBackground;
    root.dataset.umaInput = 'pointer';
    const onPointer = () => {
      if (root.dataset.umaInput !== 'pointer') {
        root.dataset.umaInput = 'pointer';
      }
    };
    const onKey = () => {
      if (root.dataset.umaInput !== 'keyboard') {
        root.dataset.umaInput = 'keyboard';
      }
    };
    const onVisibility = () => {
      const next = String(document.hidden);
      if (root.dataset.umaBackground !== next) {
        root.dataset.umaBackground = next;
      }
    };
    onVisibility();
    window.addEventListener('pointerdown', onPointer, true);
    window.addEventListener('keydown', onKey, true);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pointerdown', onPointer, true);
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('visibilitychange', onVisibility);
      if (previousInput === undefined) delete root.dataset.umaInput;
      else root.dataset.umaInput = previousInput;
      if (previousBackground === undefined) delete root.dataset.umaBackground;
      else root.dataset.umaBackground = previousBackground;
    };
  }, []);
}

/** Keep a dismissed surface mounted briefly; Escape and reduced motion are instant. */
export function useAnimatedDismiss(onClose: () => void) {
  const [closing, setClosing] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => () => {
    if (timeout.current !== null) clearTimeout(timeout.current);
  }, []);
  const dismiss = useCallback((immediate = false) => {
    if (immediate || !shouldAnimateUI()) {
      if (timeout.current !== null) clearTimeout(timeout.current);
      timeout.current = null;
      closeRef.current();
      return;
    }
    if (timeout.current !== null) return;
    setClosing(true);
    timeout.current = setTimeout(() => {
      timeout.current = null;
      closeRef.current();
    }, MOTION_EXIT_MS);
  }, []);
  return { closing, dismiss };
}
