import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import type { PageHeaderModel } from '@/lib/view-models/shared';

type PageHeaderProps = {
  header: PageHeaderModel;
  actions?: ReactNode;
  metrics?: ReactNode;
};

export function PageHeader({ header, actions, metrics }: PageHeaderProps) {
  const metaItems = header.badges?.filter(
    (badge) => badge.value !== undefined && badge.value !== null && badge.value !== '',
  );
  const actionItems = header.actions?.filter(Boolean);

  return (
    <header className="rounded-md border border-slate-200 bg-white px-4 py-3">
      <div className="grid gap-3">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950 md:text-[1.7rem]">{header.title}</h1>
            {header.meta ? <p className="mt-1 text-xs font-medium text-slate-500">{header.meta}</p> : null}
            {metaItems?.length ? (
              <dl className="mt-2 flex min-w-0 flex-wrap gap-1.5">
                {metaItems.map((badge) => (
                  <Badge className="gap-1.5 rounded-md font-normal" key={badge.label} variant="outline">
                    <dt className="text-slate-500">{badge.label}</dt>
                    <dd className="font-mono font-semibold tabular-nums text-slate-950">{badge.value}</dd>
                  </Badge>
                ))}
              </dl>
            ) : null}
            {header.description ? (
              <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600 [overflow-wrap:anywhere]">
                {header.description}
              </p>
            ) : null}
          </div>
          {actions || actionItems?.length ? (
            <div className="flex flex-wrap gap-2 md:justify-end">
              {actions}
              {actionItems?.map((action) => (
                <span
                  className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600"
                  key={action}
                >
                  {action}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        {metrics ? <div className="min-w-0">{metrics}</div> : null}
      </div>
    </header>
  );
}
