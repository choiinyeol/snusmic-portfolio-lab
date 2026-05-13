'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

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
      className="min-w-0 overflow-x-auto border-y border-slate-200 bg-white py-1"
      role="tablist"
      aria-label={ariaLabel}
    >
      <div className="flex min-w-max gap-1 px-1">
        {options.map((option) => {
          const active = option.id === value;
          const badge = kindBadge(option.kind, option.id);
          const className = [
            'inline-flex min-w-0 max-w-[13rem] items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-colors',
            active
              ? 'bg-slate-950 text-white [&_[data-slot=badge]]:border-white/20 [&_[data-slot=badge]]:bg-white/10 [&_[data-slot=badge]]:text-white'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950',
          ].join(' ');
          const content = (
            <>
              <span className="truncate" title={option.label}>
                {option.shortLabel}
              </span>
              <Badge className="shrink-0" variant={badge.variant}>
                {badge.label}
              </Badge>
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

function kindBadge(
  kind: StrategySelectorOption['kind'],
  id: string,
): {
  label: string;
  variant: 'secondary' | 'warning' | 'outline';
} {
  if (id === 'smic_follower_v2') return { label: '원장', variant: 'outline' };
  if (kind === 'strategy') return { label: '전략', variant: 'outline' };
  if (kind === 'oracle') return { label: '상한', variant: 'warning' };
  return { label: '기준', variant: 'secondary' };
}
