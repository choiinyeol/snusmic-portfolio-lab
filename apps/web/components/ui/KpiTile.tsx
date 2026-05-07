import type { ReactNode } from 'react';

type Tone = 'neutral' | 'good' | 'bad' | 'warn' | 'accent';

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
  return (
    <article className={`kpi-tile tone-${tone}${emphasis ? ' kpi-tile--emphasis' : ''}`}>
      <div className="kpi-tile__label">{label}</div>
      <div className="kpi-tile__value">{value}</div>
      {delta ? <div className="kpi-tile__delta">{delta}</div> : null}
      {caption ? <div className="kpi-tile__caption">{caption}</div> : null}
      {children ? <div className="kpi-tile__extra">{children}</div> : null}
    </article>
  );
}
