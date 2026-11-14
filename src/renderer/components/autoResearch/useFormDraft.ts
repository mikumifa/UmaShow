import { useState } from 'react';

// Compare only editable values; callers exclude timestamps and generated IDs.
export function formFingerprint(value: unknown): string {
  return JSON.stringify(value, (_key, entry) => {
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      return Object.fromEntries(
        Object.keys(entry)
          .sort()
          .map((key) => [key, entry[key]]),
      );
    }
    return entry;
  });
}

export default function useFormDraft(scope: string | null, value: unknown) {
  const fingerprint = scope === null ? '' : formFingerprint(value);
  const [saved, setSaved] = useState({ scope, fingerprint });
  // Capture a freshly loaded editor before painting, including batched loads.
  if (saved.scope !== scope) setSaved({ scope, fingerprint });
  return {
    dirty:
      scope !== null &&
      saved.scope === scope &&
      saved.fingerprint !== fingerprint,
    markSaved: () => setSaved({ scope, fingerprint }),
  };
}
