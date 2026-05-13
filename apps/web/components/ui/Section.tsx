import type { ReactNode } from 'react';

export function Section({
  eyebrow,
  title,
  caption,
  actions,
  children,
  id,
}: {
  eyebrow?: string;
  title: string;
  caption?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section className="grid gap-4" id={id}>
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-2 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          {eyebrow ? (
            <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              {eyebrow}
            </div>
          ) : null}
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950 md:text-2xl">{title}</h2>
          {caption ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{caption}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </header>
      <div className="grid gap-4">{children}</div>
    </section>
  );
}
