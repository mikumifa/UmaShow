/* eslint-disable react/jsx-props-no-spreading, jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
import {
  type ButtonHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { Ban, Check } from 'lucide-react';
import AssetIcon from 'renderer/components/trainingHistory/AssetIcon';

import './PlannerComponents.css';

export type PlannerFactorTone =
  | 'stat'
  | 'aptitude'
  | 'unique'
  | 'race'
  | 'skill'
  | 'white';

export type PlannerFactor = {
  id: number | string;
  name: string;
  stars?: number;
  count?: number;
  tone: PlannerFactorTone;
  title?: string;
};

export function PlannerPortrait({
  path,
  src,
  alt,
  fallback,
  size = 'medium',
  loading = 'lazy',
  className = '',
}: {
  path?: string | null;
  src?: string | null;
  alt: string;
  fallback?: ReactNode;
  size?: 'small' | 'medium' | 'large';
  loading?: 'eager' | 'lazy';
  className?: string;
}) {
  const portraitClassName =
    `plannerUiTheme plannerPortrait ${size} ${className}`.trim();
  if (path) {
    return (
      <span className={portraitClassName}>
        <AssetIcon
          path={path}
          alt={alt}
          className="plannerPortraitImage"
          fallback={fallback}
          loading={loading}
        />
      </span>
    );
  }
  if (src) {
    return (
      <span className={portraitClassName}>
        <img
          src={src}
          alt={alt}
          className="plannerPortraitImage"
          loading={loading}
          draggable={false}
        />
      </span>
    );
  }
  return (
    <span className={`${portraitClassName} fallback`} aria-label={alt}>
      {fallback || alt.slice(0, 1) || '?'}
    </span>
  );
}

export function PlannerFactorBadge({
  factor,
  compact = false,
}: {
  factor: PlannerFactor;
  compact?: boolean;
}) {
  return (
    <span
      className={`plannerUiTheme plannerFactorBadge ${factor.tone} ${
        compact ? 'compact' : ''
      }`}
      title={factor.title || String(factor.name)}
    >
      <span>{factor.name}</span>
      {factor.stars !== undefined ? <b>{factor.stars}★</b> : null}
      {factor.count !== undefined ? <b>×{factor.count}</b> : null}
    </span>
  );
}

export function PlannerFactorList({
  factors,
  compact = false,
  className = '',
}: {
  factors: PlannerFactor[];
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`plannerUiTheme plannerFactorList ${
        compact ? 'compact' : ''
      } ${className}`.trim()}
    >
      {factors.map((factor, index) => (
        <PlannerFactorBadge
          key={`${factor.id}:${index}`}
          factor={factor}
          compact={compact}
        />
      ))}
    </div>
  );
}

type PlannerButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'type'
> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'filter';
  size?: 'small' | 'medium';
  active?: boolean;
};

export function PlannerButton({
  variant = 'secondary',
  size = 'medium',
  active = false,
  className = '',
  ...props
}: PlannerButtonProps) {
  return (
    <button
      {...props}
      type="button"
      className={`plannerUiTheme plannerButton ${variant} ${size} ${
        active ? 'active' : ''
      } ${className}`.trim()}
    />
  );
}

type PlannerSelectionState = 'selected' | 'occupied' | 'disabled';

const PLANNER_SELECTION_STATE_LABELS: Record<PlannerSelectionState, string> = {
  selected: '已选择',
  occupied: '其他位已选',
  disabled: '禁止选择',
};

function resolvePlannerSelectionState({
  selected,
  occupied = false,
  disabled,
}: {
  selected: boolean;
  occupied?: boolean;
  disabled: boolean;
}): PlannerSelectionState | null {
  if (selected) return 'selected';
  if (occupied) return 'occupied';
  if (disabled) return 'disabled';
  return null;
}

function PlannerSelectionStateBadge({
  state,
}: {
  state: PlannerSelectionState;
}) {
  const label = PLANNER_SELECTION_STATE_LABELS[state];
  return (
    <span className={`plannerSelectionState ${state}`} aria-label={label}>
      {state === 'disabled' ? (
        <Ban size={13} strokeWidth={2.5} />
      ) : (
        <Check size={13} strokeWidth={3} />
      )}
      <span>{label}</span>
    </span>
  );
}

export function PlannerSelectionCard({
  portrait,
  title,
  subtitle,
  details,
  selected = false,
  occupied = false,
  disabled = false,
  onClick,
}: {
  portrait: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  details?: ReactNode;
  selected?: boolean;
  occupied?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const state = resolvePlannerSelectionState({
    selected,
    occupied,
    disabled,
  });
  return (
    <button
      type="button"
      className={`plannerUiTheme plannerSelectionCard ${state || ''} ${
        state ? 'hasState' : ''
      }`.trim()}
      aria-pressed={selected}
      disabled={disabled || occupied}
      onClick={onClick}
    >
      {portrait}
      <span className="plannerSelectionCardCopy">
        <strong>{title}</strong>
        {subtitle ? <small>{subtitle}</small> : null}
        {details}
      </span>
      {state ? <PlannerSelectionStateBadge state={state} /> : null}
    </button>
  );
}

export function PlannerSkillCard({
  iconPath,
  name,
  meta,
  rarity = 1,
  selected = false,
  disabled = false,
  onClick,
}: {
  iconPath?: string | null;
  name: string;
  meta?: ReactNode;
  rarity?: number;
  selected?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`plannerUiTheme plannerSkillCard rarity${rarity} ${
        selected ? 'selected' : ''
      }`}
      disabled={disabled}
      aria-pressed={selected}
      onClick={onClick}
    >
      <span className="plannerSkillCardIcon">
        {iconPath ? (
          <AssetIcon
            path={iconPath}
            alt={name}
            className="plannerSkillCardIconImage"
          />
        ) : null}
      </span>
      <span className="plannerSkillCardCopy">
        <strong>{name}</strong>
        {meta ? <small>{meta}</small> : null}
      </span>
      {selected ? (
        <span className="plannerSkillCardCheck" aria-label="当前选择">
          <Check size={14} strokeWidth={3} />
        </span>
      ) : null}
    </button>
  );
}

export type PlannerLineageMember = {
  key: string;
  label?: string;
  name: string;
  subtitle?: ReactNode;
  portrait: ReactNode;
  factors: PlannerFactor[];
};

export function PlannerLineageCard({
  member,
  parents,
  selected = false,
  disabled = false,
  viewOnly = false,
  extra,
  onSelect,
  onDetails,
}: {
  member: PlannerLineageMember;
  parents: PlannerLineageMember[];
  selected?: boolean;
  disabled?: boolean;
  viewOnly?: boolean;
  extra?: ReactNode;
  onSelect?: () => void;
  onDetails?: () => void;
}) {
  const interactive = Boolean(onSelect) && !disabled && !viewOnly;
  const state = resolvePlannerSelectionState({ selected, disabled });
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!interactive || event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect?.();
    }
  };
  return (
    <article
      className={`plannerUiTheme plannerLineageCard ${
        selected ? 'selected' : ''
      } ${disabled ? 'disabled' : ''} ${viewOnly ? 'viewOnly' : ''}`.trim()}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-pressed={interactive ? selected : undefined}
      onClick={interactive ? onSelect : undefined}
      onKeyDown={onKeyDown}
    >
      <header className="plannerLineageSelf">
        {member.portrait}
        <span className="plannerLineageIdentity">
          {member.label ? <small>{member.label}</small> : null}
          <strong>{member.name}</strong>
          {member.subtitle ? <em>{member.subtitle}</em> : null}
        </span>
        {state || onDetails ? (
          <span className="plannerLineageActions">
            {state ? <PlannerSelectionStateBadge state={state} /> : null}
            {onDetails ? (
              <PlannerButton
                size="small"
                variant="secondary"
                className="plannerLineageDetails"
                onClick={(event) => {
                  event.stopPropagation();
                  onDetails();
                }}
              >
                查看详细
              </PlannerButton>
            ) : null}
          </span>
        ) : null}
      </header>
      <PlannerFactorList factors={member.factors} compact />
      {extra}
      {parents.length ? (
        <div className="plannerLineageParents">
          {parents.map((parent) => (
            <section key={parent.key}>
              <header>
                {parent.portrait}
                <span>
                  {parent.label ? <small>{parent.label}</small> : null}
                  <strong>{parent.name}</strong>
                  {parent.subtitle ? <em>{parent.subtitle}</em> : null}
                </span>
              </header>
              <PlannerFactorList factors={parent.factors} compact />
            </section>
          ))}
        </div>
      ) : null}
    </article>
  );
}
