import Link from 'next/link';
import type { ReactNode } from 'react';

type Tone = 'neutral' | 'good' | 'bad' | 'warn' | 'accent';

export function TerminalHero({ eyebrow, title, children, actions }: { eyebrow: string; title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="hero terminal-frame card bg-base-100 border border-base-300 shadow-sm">
      <div className="card-body gap-4 p-6 md:p-8">
        <div className="eyebrow badge badge-primary badge-soft badge-sm w-fit tracking-[0.16em]">{eyebrow}</div>
        <h1 className="text-4xl font-black leading-none tracking-[-0.055em] text-base-content md:text-6xl">{title}</h1>
        <div className="hero-copy max-w-3xl text-base-content/70">{children}</div>
        {actions ? <div className="action-row flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </section>
  );
}

export function MetricCard({ label, value, detail, tone = 'neutral' }: { label: string; value: ReactNode; detail?: ReactNode; tone?: Tone }) {
  return (
    <article className={`card metric-card bg-base-100 border border-base-300 shadow-sm tone-${tone}`}>
      <div className="card-body gap-2 p-5">
        <div className="stat-title text-base-content/60">{label}</div>
        <div className="stat-value text-2xl leading-tight tracking-[-0.04em] text-base-content">{value}</div>
        {detail ? <p className="stat-desc whitespace-normal text-base-content/60">{detail}</p> : null}
      </div>
    </article>
  );
}

export function Panel({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`panel card bg-base-100 border border-base-300 shadow-sm ${className}`.trim()}>
      <div className="card-body p-5 md:p-6">
        {title ? <h2 className="card-title text-xl md:text-2xl">{title}</h2> : null}
        {children}
      </div>
    </section>
  );
}

export function StatusPill({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  const color = tone === 'good' ? 'badge-success' : tone === 'bad' ? 'badge-error' : tone === 'warn' ? 'badge-warning' : tone === 'accent' ? 'badge-primary' : 'badge-ghost';
  return <span className={`badge badge-soft ${color}`}>{children}</span>;
}

export function TerminalLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link className="btn btn-sm btn-outline" href={href}>{children}</Link>;
}
