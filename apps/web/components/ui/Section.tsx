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
    <section className="layout-section" id={id}>
      <header className="layout-section__head">
        <div className="layout-section__title">
          {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
          <h2>{title}</h2>
          {caption ? <p className="layout-section__caption">{caption}</p> : null}
        </div>
        {actions ? <div className="layout-section__actions">{actions}</div> : null}
      </header>
      <div className="layout-section__body">{children}</div>
    </section>
  );
}
