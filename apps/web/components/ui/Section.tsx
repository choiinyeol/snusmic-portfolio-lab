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
    <section className="layout-section grid gap-5" id={id}>
      <header className="layout-section__head flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="layout-section__title max-w-3xl">
          {eyebrow ? <div className="eyebrow badge badge-primary badge-soft badge-sm w-fit tracking-[0.16em]">{eyebrow}</div> : null}
          <h2 className="text-2xl font-black tracking-[-0.04em] text-base-content md:text-3xl">{title}</h2>
          {caption ? <p className="layout-section__caption mt-2 max-w-3xl text-base leading-7 text-base-content/65">{caption}</p> : null}
        </div>
        {actions ? <div className="layout-section__actions flex flex-wrap gap-2">{actions}</div> : null}
      </header>
      <div className="layout-section__body grid gap-5">{children}</div>
    </section>
  );
}
