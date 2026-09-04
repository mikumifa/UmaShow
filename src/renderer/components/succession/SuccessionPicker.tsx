/* eslint-disable jsx-a11y/label-has-associated-control, jsx-a11y/no-autofocus, jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-static-element-interactions */
import { ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';

import 'renderer/ui/SuccessionPlanner.css';

type SuccessionPickerDialogProps = {
  ariaLabel: string;
  title: string;
  description: string;
  onClose: () => void;
  eyebrow?: string;
  dialogClassName?: string;
  searchValue?: string;
  searchPlaceholder?: string;
  searchAriaLabel?: string;
  onSearchChange?: (value: string) => void;
  meta?: ReactNode;
  bodyClassName?: string;
  footer?: ReactNode;
  onEscape?: () => void;
  children: ReactNode;
};

export function SuccessionPickerDialog({
  ariaLabel,
  title,
  description,
  onClose,
  eyebrow,
  dialogClassName = '',
  searchValue,
  searchPlaceholder,
  searchAriaLabel,
  onSearchChange,
  meta,
  bodyClassName,
  footer,
  onEscape,
  children,
}: SuccessionPickerDialogProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') (onEscape || onClose)();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose, onEscape]);

  const hasToolbar = onSearchChange || meta;

  return createPortal(
    <div
      className="successionPickerTheme successionPickerOverlay"
      onMouseDown={onClose}
    >
      <section
        className={`successionPickerDialog ${dialogClassName}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="successionPickerHeader">
          <div>
            {eyebrow ? <span>{eyebrow}</span> : null}
            <h3>{title}</h3>
            <p>{description}</p>
          </div>
          <button
            type="button"
            className="successionPickerClose"
            aria-label="关闭选择界面"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        {hasToolbar ? (
          <div className="successionPickerToolbar">
            {onSearchChange ? (
              <label className="successionPickerSearch">
                <input
                  type="text"
                  value={searchValue || ''}
                  autoFocus
                  placeholder={searchPlaceholder}
                  aria-label={searchAriaLabel}
                  onChange={(event) =>
                    onSearchChange(event.currentTarget.value)
                  }
                />
              </label>
            ) : null}
            {meta ? <div className="successionPickerMeta">{meta}</div> : null}
          </div>
        ) : null}

        {bodyClassName ? (
          <div className={bodyClassName}>{children}</div>
        ) : (
          children
        )}
        {footer ? (
          <footer className="successionPickerFooter">{footer}</footer>
        ) : null}
      </section>
    </div>,
    document.body,
  );
}

type SuccessionPickerTriggerProps = {
  label: string;
  selected: boolean;
  required?: boolean;
  disabled?: boolean;
  portrait?: ReactNode;
  children?: ReactNode;
  trailing?: ReactNode;
  titleActions?: ReactNode;
  modeSelector?: ReactNode;
  footer?: ReactNode;
  placeholder?: string;
  onOpen: () => void;
  onClear?: () => void;
};

export function SuccessionPickerTrigger({
  label,
  selected,
  required = false,
  disabled = false,
  portrait,
  children,
  trailing,
  titleActions,
  modeSelector,
  footer,
  placeholder,
  onOpen,
  onClear,
}: SuccessionPickerTriggerProps) {
  return (
    <div
      className={`successionPickerTheme successionUmaSelect ${
        selected ? 'selected' : ''
      }${modeSelector ? ' withModeSelector' : ''}`}
    >
      <div className="successionUmaSelectTitle">
        <span>{!selected && modeSelector ? '未设置' : label}</span>
        {selected && (titleActions || onClear) ? (
          <div className="successionUmaSelectActions">
            {titleActions}
            {onClear ? (
              <button
                type="button"
                onClick={onClear}
                aria-label={`清除${label}`}
              >
                清除
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {(selected || !modeSelector) && (
        <button
          type="button"
          className="successionUmaTrigger"
          aria-label={label}
          disabled={disabled}
          onClick={onOpen}
        >
          {selected ? (
            <>
              {portrait}
              <div className="successionSelectedUma">{children}</div>
              {trailing}
            </>
          ) : (
            <>
              {required ? (
                <span className="successionPortrait empty">+</span>
              ) : null}
              <div className="successionUmaPlaceholder">
                <strong>
                  {placeholder || (required ? '请选择马娘' : '不固定')}
                </strong>
              </div>
            </>
          )}
        </button>
      )}
      {modeSelector}
      {selected ? footer : null}
    </div>
  );
}
