import type { ReactNode } from 'react';

export function Panel({
  eyebrow,
  title,
  caption,
  actions,
  children,
  className = '',
  bodyClassName = '',
}: {
  eyebrow?: string;
  title?: string;
  caption?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <article
      className={`min-w-0 overflow-hidden rounded-[22px] border border-base-300 bg-base-100/95 shadow-sm ${className}`}
    >
      {title || eyebrow || caption || actions ? (
        <div className="flex min-w-0 items-start justify-between gap-3 border-b border-base-200 bg-base-200/35 px-4 py-3">
          <div className="min-w-0">
            {eyebrow ? (
              <div className="font-mono text-[0.66rem] font-extrabold uppercase tracking-[0.13em] text-base-content/45">
                {eyebrow}
              </div>
            ) : null}
            {title ? (
              <h2 className="mt-0.5 text-base font-black tracking-[-0.025em] text-base-content">{title}</h2>
            ) : null}
            {caption ? <p className="mt-1 text-xs leading-5 text-base-content/55">{caption}</p> : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      ) : null}
      <div className={bodyClassName || 'p-4'}>{children}</div>
    </article>
  );
}
