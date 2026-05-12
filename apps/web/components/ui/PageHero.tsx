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
    <header className="overflow-hidden rounded-box border border-base-300 bg-[linear-gradient(135deg,#ffffff_0%,#f7faff_62%,#eef5ff_100%)] shadow-sm">
      <div
        className={`relative grid overflow-hidden gap-5 p-5 md:p-6 ${hasRightRail ? 'md:grid-cols-[minmax(0,1fr)_minmax(320px,.85fr)]' : ''}`}
      >
        <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative grid min-w-0 content-center gap-3">
          {eyebrow ? (
            <span className="badge badge-primary badge-soft w-fit text-xs tracking-[0.18em]">{eyebrow}</span>
          ) : null}
          <h1 className="text-3xl font-black tracking-[-0.055em] text-base-content md:text-4xl">{title}</h1>
          {subtitle ? (
            <p className="max-w-3xl text-sm leading-relaxed text-base-content/65 md:text-[0.98rem]">{subtitle}</p>
          ) : null}
          {badges?.length ? (
            <dl className="flex flex-wrap gap-1.5">
              {badges.map((badge) => (
                <span
                  key={badge.label}
                  className="inline-flex items-center gap-1 rounded-full border border-base-300 bg-white/70 px-2.5 py-1 text-xs shadow-sm"
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
        {kpis ? <div className="relative min-w-0">{kpis}</div> : null}
      </div>
    </header>
  );
}
