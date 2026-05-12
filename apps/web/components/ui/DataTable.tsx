import type { ReactNode } from 'react';

export function TableCard({ title, meta, children }: { title: string; meta?: ReactNode; children: ReactNode }) {
  return (
    <div className="ledger-table-card card min-w-0 bg-base-100 border border-base-300 shadow-sm">
      <div className="ledger-table-card__head card-body min-w-0 gap-1 border-b border-base-300 p-4 md:p-5">
        <h3 className="card-title text-base md:text-lg">{title}</h3>
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
    'rounded-box',
    'border',
    'border-base-300',
    'bg-base-100',
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
