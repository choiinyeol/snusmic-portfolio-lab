import type { ReactNode } from 'react';

type Badge = { label: string; value?: string | number | null };

type Props = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  badges?: Badge[];
  actions?: ReactNode;
  kpis?: ReactNode;
};

export function PageHero({ eyebrow, title, subtitle, badges, actions, kpis }: Props) {
  const hasRightRail = Boolean(kpis);
  return (
    <header className="rounded-box border border-base-300 bg-base-100 shadow-sm">
      <div
        className={`grid gap-5 p-5 md:p-6 ${hasRightRail ? 'md:grid-cols-[minmax(0,1fr)_minmax(320px,.85fr)]' : ''}`}
      >
        <div className="grid content-center gap-3 min-w-0">
          {eyebrow ? (
            <span className="badge badge-primary badge-soft w-fit text-xs tracking-[0.16em]">{eyebrow}</span>
          ) : null}
          <h1 className="text-2xl font-black tracking-[-0.04em] text-base-content md:text-3xl">{title}</h1>
          {subtitle ? (
            <p className="max-w-3xl text-sm leading-relaxed text-base-content/65 md:text-base">{subtitle}</p>
          ) : null}
          {badges?.length ? (
            <dl className="flex flex-wrap gap-1.5">
              {badges.map((badge) => (
                <span
                  key={badge.label}
                  className="inline-flex items-center gap-1 rounded-full border border-base-300 bg-base-200/60 px-2.5 py-1 text-xs"
                >
                  <dt className="text-base-content/55">{badge.label}</dt>
                  {badge.value !== undefined && badge.value !== null && badge.value !== '' ? (
                    <dd className="font-semibold text-base-content">{badge.value}</dd>
                  ) : null}
                </span>
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
