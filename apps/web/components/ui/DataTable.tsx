import type { ReactNode } from 'react';

export function TableCard({ title, meta, children }: { title: string; meta?: ReactNode; children: ReactNode }) {
  return (
    <div className="ledger-table-card">
      <div className="ledger-table-card__head">
        <h3>{title}</h3>
        {meta ? <span>{meta}</span> : null}
      </div>
      {children}
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
  const classes = ['table-wrap', 'inset', 'data-table', compact ? 'compact-table' : '', className].filter(Boolean).join(' ');
  return (
    <div className={classes}>
      <table>{children}</table>
    </div>
  );
}
