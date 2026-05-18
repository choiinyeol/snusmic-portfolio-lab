import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';

type Tone = 'neutral' | 'good' | 'bad' | 'warn' | 'accent';

const toneClasses: Record<
  Tone,
  { value: string; badge: 'secondary' | 'success' | 'destructive' | 'warning' | 'outline'; border: string }
> = {
  neutral: { value: 'text-slate-950', badge: 'secondary', border: 'border-slate-200' },
  good: { value: 'text-emerald-600', badge: 'success', border: 'border-emerald-200' },
  bad: { value: 'text-red-600', badge: 'destructive', border: 'border-red-200' },
  warn: { value: 'text-amber-600', badge: 'warning', border: 'border-amber-200' },
  accent: { value: 'text-blue-600', badge: 'outline', border: 'border-blue-200' },
};

export function KpiTile({
  label,
  value,
  delta,
  caption,
  tone = 'neutral',
  emphasis = false,
  children,
  icon,
  meta,
  compact = false,
  valueClassName,
  showToneBadge = false,
}: {
  label: string;
  value: ReactNode;
  delta?: ReactNode;
  caption?: ReactNode;
  tone?: Tone;
  emphasis?: boolean;
  children?: ReactNode;
  icon?: ReactNode;
  meta?: ReactNode;
  compact?: boolean;
  valueClassName?: string;
  showToneBadge?: boolean;
}) {
  const toneClass = toneClasses[tone];
  return (
    <article
      data-tone={tone}
      aria-label={`${label} ${typeof value === 'string' || typeof value === 'number' ? value : ''}`.trim()}
      className={`min-w-0 rounded-xl border bg-white ${toneClass.border} ${emphasis ? 'ring-1 ring-slate-950/5' : ''}`}
    >
      <div className={`grid min-w-0 gap-2 ${compact ? 'p-3' : 'p-4'}`}>
        <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2">
          {icon ? (
            <div className="mt-0.5 shrink-0 text-slate-500" aria-hidden="true">
              {icon}
            </div>
          ) : null}
          <div className="min-w-0 text-xs font-medium text-slate-500">{label}</div>
          {showToneBadge ? (
            <Badge className="shrink-0" variant={toneClass.badge}>
              {toneLabel(tone)}
            </Badge>
          ) : null}
        </div>
        <div
          className={`font-mono text-2xl font-semibold tracking-tight tabular-nums ${toneClass.value} ${valueClassName ?? ''}`}
        >
          {value}
        </div>
        {delta || meta ? (
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-slate-500">
            {delta ? <span className="min-w-0 break-words">{delta}</span> : null}
            {meta ? <span className="min-w-0 text-slate-400">{meta}</span> : null}
          </div>
        ) : null}
        {caption ? <div className="text-sm leading-6 text-slate-600">{caption}</div> : null}
        {children ? <div className="mt-auto pt-1">{children}</div> : null}
      </div>
    </article>
  );
}

function toneLabel(tone: Tone): string {
  if (tone === 'good') return '좋음';
  if (tone === 'bad') return '위험';
  if (tone === 'warn') return '주의';
  if (tone === 'accent') return '핵심';
  return '';
}
