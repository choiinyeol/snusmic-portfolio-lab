'use client';

import Link from 'next/link';

export type StrategySelectorOption = {
  id: string;
  label: string;
  shortLabel: string;
  kind: 'benchmark' | 'strategy' | 'oracle';
  href?: string;
};

export function StrategySelector({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: StrategySelectorOption[];
  value: string;
  onChange?: (value: string) => void;
  ariaLabel: string;
}) {
  return (
    <div
      className="min-w-0 overflow-x-auto rounded-2xl border border-base-300 bg-base-200/70 p-1"
      role="tablist"
      aria-label={ariaLabel}
    >
      <div className="flex min-w-max gap-1">
        {options.map((option) => {
          const active = option.id === value;
          const badge = kindBadge(option.kind);
          const className = [
            'inline-flex min-w-0 max-w-[12rem] items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black transition',
            active
              ? 'bg-base-100 text-primary shadow-sm ring-1 ring-primary/15'
              : 'text-base-content/62 hover:bg-base-100/70 hover:text-base-content',
          ].join(' ');
          const content = (
            <>
              <span className="truncate" title={option.label}>
                {option.shortLabel}
              </span>
              <span className={`badge badge-xs shrink-0 ${badge.className}`}>{badge.label}</span>
            </>
          );
          if (onChange) {
            return (
              <button
                aria-selected={active}
                className={className}
                key={option.id}
                onClick={() => onChange(option.id)}
                role="tab"
                title={option.label}
                type="button"
              >
                {content}
              </button>
            );
          }
          return (
            <Link
              aria-current={active ? 'page' : undefined}
              className={className}
              href={option.href ?? `/portfolio?strategy=${encodeURIComponent(option.id)}`}
              key={option.id}
              title={option.label}
            >
              {content}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function kindBadge(kind: StrategySelectorOption['kind']): { label: string; className: string } {
  if (kind === 'strategy') return { label: '전략', className: 'badge-primary badge-soft' };
  if (kind === 'oracle') return { label: '상한', className: 'badge-warning badge-soft' };
  return { label: '기준', className: 'badge-ghost' };
}
