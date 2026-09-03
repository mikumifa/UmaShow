/* eslint-disable react/jsx-props-no-spreading */
import { ComponentPropsWithoutRef, useEffect, useRef, useState } from 'react';

type EditableNumberInputProps = Omit<
  ComponentPropsWithoutRef<'input'>,
  'type' | 'value' | 'defaultValue' | 'onChange' | 'inputMode'
> & {
  value: number;
  onValueChange: (value: number) => void;
};

const finiteBound = (value: string | number | undefined) => {
  if (value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export default function EditableNumberInput({
  value,
  onValueChange,
  min,
  max,
  onBlur,
  onFocus,
  onKeyDown,
  ...inputProps
}: EditableNumberInputProps) {
  const [draft, setDraft] = useState(String(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(String(value));
  }, [value]);

  const commitDraft = () => {
    const parsed = Number(draft.trim());
    if (!draft.trim() || !Number.isFinite(parsed)) {
      setDraft(String(value));
      return;
    }

    const minimum = finiteBound(min);
    const maximum = finiteBound(max);
    const normalized = Math.min(
      maximum ?? Number.POSITIVE_INFINITY,
      Math.max(minimum ?? Number.NEGATIVE_INFINITY, parsed),
    );
    setDraft(String(normalized));
    onValueChange(normalized);
  };

  return (
    <input
      {...inputProps}
      type="text"
      inputMode="decimal"
      value={draft}
      onChange={(event) => {
        const nextDraft = event.target.value;
        setDraft(nextDraft);
        const parsed = Number(nextDraft.trim());
        if (nextDraft.trim() && Number.isFinite(parsed)) {
          onValueChange(parsed);
        }
      }}
      onFocus={(event) => {
        focused.current = true;
        onFocus?.(event);
      }}
      onBlur={(event) => {
        focused.current = false;
        commitDraft();
        onBlur?.(event);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        onKeyDown?.(event);
      }}
    />
  );
}
