import type { ReactNode } from 'react';

export function TableCard({ title, meta, children }: { title: string; meta?: ReactNode; children: ReactNode }) {
  return (
    <div className="ledger-table-card rounded-2xl min-w-0 bg-white border border-slate-200 shadow-sm">
      <div className="ledger-table-card__head flex flex-col min-w-0 gap-1 border-b border-slate-200 p-4 md:p-5">
        <h3 className="text-base font-semibold text-slate-950 text-base md:text-lg">{title}</h3>
        {meta ? <span className="badge badge-ghost badge-sm w-fit">{meta}</span> : null}
      </div>
      <div className="p-0">{children}</div>
    </div>
  );
}

export function DataTable({
  children,
  compact = false,
  className = '',
}: {
  children: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  const classes = [
    'table-wrap',
    'overflow-x-auto',
    'rounded-2xl',
    'border',
    'border-slate-200',
    'bg-white',
    'shadow-sm',
    compact ? 'compact-table' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={classes}>
      <table className={`table ${compact ? 'table-sm' : ''}`}>{children}</table>
    </div>
  );
}
