/* eslint-disable jsx-a11y/label-has-associated-control, jsx-a11y/no-autofocus, jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-static-element-interactions */
import { ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';

import {
  PlannerButton,
  type PlannerFactor,
  PlannerFactorList,
} from './PlannerComponents';

import 'renderer/ui/SuccessionPlanner.css';

type SuccessionPickerDialogProps = {
  ariaLabel: string;
  title: string;
  description?: string;
  onClose: () => void;
  eyebrow?: string;
  overlayClassName?: string;
  dialogClassName?: string;
  searchValue?: string;
  searchPlaceholder?: string;
  searchAriaLabel?: string;
  onSearchChange?: (value: string) => void;
  meta?: ReactNode;
  bodyClassName?: string;
  footer?: ReactNode;
  onEscape?: () => void;
  escapePriority?: boolean;
  children: ReactNode;
};

export function SuccessionPickerDialog({
  ariaLabel,
  title,
  description,
  onClose,
  eyebrow,
  overlayClassName = '',
  dialogClassName = '',
  searchValue,
  searchPlaceholder,
  searchAriaLabel,
  onSearchChange,
  meta,
  bodyClassName,
  footer,
  onEscape,
  escapePriority = false,
  children,
}: SuccessionPickerDialogProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (escapePriority) event.stopImmediatePropagation();
      (onEscape || onClose)();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown, escapePriority);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown, escapePriority);
    };
  }, [escapePriority, onClose, onEscape]);

  const hasToolbar = onSearchChange || meta;

  return createPortal(
    <div
      className={`successionPickerTheme successionPickerOverlay ${overlayClassName}`.trim()}
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
            {description ? <p>{description}</p> : null}
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

export type SuccessionFactorDetailFactor = PlannerFactor & { stars: number };

export type SuccessionFactorDetailMember = {
  key: string;
  label: string;
  name: string;
  subtitle?: string;
  portrait: ReactNode;
  factors: SuccessionFactorDetailFactor[];
};

export function SuccessionFactorDetailModal({
  ariaLabel,
  title,
  description,
  members,
  onClose,
  onSelect,
}: {
  ariaLabel: string;
  title: string;
  description: string;
  members: SuccessionFactorDetailMember[];
  onClose: () => void;
  onSelect?: () => void;
}) {
  return (
    <SuccessionPickerDialog
      ariaLabel={ariaLabel}
      title={title}
      description={description}
      onClose={onClose}
      escapePriority
      overlayClassName="successionCapturedDetailOverlay"
      dialogClassName="successionCapturedDetailDialog"
    >
      <div className="successionCapturedDetailMembers">
        {members.map((member) => (
          <article key={member.key}>
            <header>
              {member.portrait}
              <span>
                <small>{member.label}</small>
                <strong>{member.name}</strong>
                {member.subtitle ? <em>{member.subtitle}</em> : null}
              </span>
            </header>
            <PlannerFactorList
              factors={member.factors.map((factor) => ({
                ...factor,
                title: `因子 ID ${factor.id}`,
              }))}
            />
          </article>
        ))}
      </div>
      <footer className="successionCapturedDetailActions">
        <PlannerButton variant="secondary" onClick={onClose}>
          关闭
        </PlannerButton>
        {onSelect ? (
          <PlannerButton variant="primary" onClick={onSelect}>
            选择此马娘
          </PlannerButton>
        ) : null}
      </footer>
    </SuccessionPickerDialog>
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
