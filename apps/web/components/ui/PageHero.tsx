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
  void eyebrow;
  return (
    <header className="rounded-md border border-slate-200 bg-white px-4 py-3">
      <div className="grid gap-3">
        <div className="grid min-w-0 gap-2">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950 md:text-[1.7rem]">{title}</h1>
              {subtitle ? (
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 [overflow-wrap:anywhere] [word-break:break-all]">
                  {subtitle}
                </p>
              ) : null}
            </div>
            {actions ? <div className="flex flex-wrap gap-2 md:justify-end">{actions}</div> : null}
          </div>
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
        </div>
        {kpis ? <div className="min-w-0">{kpis}</div> : null}
      </div>
    </header>
  );
}
