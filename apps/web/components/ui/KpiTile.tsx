import type { ReactNode } from 'react';

type Tone = 'neutral' | 'good' | 'bad' | 'warn' | 'accent';

const toneClasses: Record<Tone, { value: string; badge: string; border: string }> = {
  neutral: { value: 'text-base-content', badge: 'badge-ghost', border: 'border-base-300' },
  good: { value: 'text-success', badge: 'badge-success badge-soft', border: 'border-success/20' },
  bad: { value: 'text-error', badge: 'badge-error badge-soft', border: 'border-error/20' },
  warn: { value: 'text-warning', badge: 'badge-warning badge-soft', border: 'border-warning/20' },
  accent: { value: 'text-primary', badge: 'badge-primary badge-soft', border: 'border-primary/20' },
};

export function KpiTile({
  label,
  value,
  delta,
  caption,
  tone = 'neutral',
  emphasis = false,
  children,
}: {
  label: string;
  value: ReactNode;
  delta?: ReactNode;
  caption?: ReactNode;
  tone?: Tone;
  emphasis?: boolean;
  children?: ReactNode;
}) {
  const toneClass = toneClasses[tone];
  return (
    <article
      data-tone={tone}
      className={`kpi-tile card overflow-hidden bg-base-100/95 text-base-content border ${toneClass.border} shadow-sm ${emphasis ? 'kpi-tile--emphasis ring-1 ring-primary/10' : ''}`}
    >
      <div className="card-body min-w-0 gap-2 p-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="kpi-tile__label min-w-0 font-semibold uppercase tracking-[0.08em] text-base-content/55">
            {label}
          </div>
          {tone !== 'neutral' ? <span className={`badge badge-sm ${toneClass.badge}`}>{toneLabel(tone)}</span> : null}
        </div>
        <div className={`kpi-tile__value ${toneClass.value}`}>{value}</div>
        {delta ? <div className="kpi-tile__delta font-semibold text-base-content/65">{delta}</div> : null}
        {caption ? (
          <div className="kpi-tile__caption text-sm leading-relaxed text-base-content/55">{caption}</div>
        ) : null}
        {children ? <div className="kpi-tile__extra pt-1">{children}</div> : null}
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
