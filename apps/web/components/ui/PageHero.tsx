import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';

type HeroBadge = { label: string; value?: string | number | null };

type Props = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  badges?: HeroBadge[];
  actions?: ReactNode;
  kpis?: ReactNode;
};

export function PageHero({ eyebrow, title, subtitle, badges, actions, kpis }: Props) {
  const hasRightRail = Boolean(kpis);
  return (
    <header className="border-b border-slate-200 pb-5">
      <div
        className={`grid gap-5 ${hasRightRail ? 'xl:grid-cols-[minmax(0,1fr)_minmax(420px,.85fr)] xl:items-end' : ''}`}
      >
        <div className="grid min-w-0 gap-3">
          {eyebrow ? (
            <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              {eyebrow}
            </div>
          ) : null}
          <h1 className="text-3xl font-semibold tracking-[-0.045em] text-slate-950 md:text-4xl">{title}</h1>
          {subtitle ? <p className="max-w-3xl text-sm leading-6 text-slate-600">{subtitle}</p> : null}
          {badges?.length ? (
            <dl className="flex min-w-0 flex-wrap gap-1.5">
              {badges.map((badge) => (
                <Badge className="gap-1.5 font-normal" key={badge.label} variant="outline">
                  <dt className="text-slate-500">{badge.label}</dt>
                  {badge.value !== undefined && badge.value !== null && badge.value !== '' ? (
                    <dd className="font-semibold text-slate-950">{badge.value}</dd>
                  ) : null}
                </Badge>
              ))}
            </dl>
          ) : null}
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
        {kpis ? <div className="min-w-0">{kpis}</div> : null}
      </div>
    </header>
  );
}
