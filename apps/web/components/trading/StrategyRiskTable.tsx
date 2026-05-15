import Link from 'next/link';
import { formatPercent, signedTextClass } from '@/lib/format';
import type { StrategyLeaderboardRow } from '@/lib/product-model';

export function StrategyRiskTable({ rows }: { rows: StrategyLeaderboardRow[] }) {
  return (
    <article className="board-table-wrap">
      <table className="board-table table table-sm table-density-compact w-full">
        <thead>
          <tr>
            <th>구분</th>
            <th>이름</th>
            <th className="text-right">수익률</th>
            <th className="text-right">Sharpe</th>
            <th className="text-right">Sortino</th>
            <th className="text-right">MDD</th>
            <th className="text-right">KOSPI 초과</th>
            <th className="text-right">목표</th>
            <th className="text-right">거래</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <span className={`badge badge-sm ${kindBadgeClass(row.kind)}`}>{kindLabel(row.kind)}</span>
              </td>
              <td className="min-w-[130px] max-w-[230px]">
                <Link className="block min-w-0" href={row.href} title={row.label}>
                  <span className="block truncate font-bold">{row.shortLabel || row.label}</span>
                  <span className="block truncate text-[11px] font-medium text-slate-950/45">{row.label}</span>
                </Link>
              </td>
              <td className={`text-right font-mono font-black tabular-nums ${signedTextClass(row.returnPct)}`}>
                {formatPercent(row.returnPct)}
              </td>
              <td className="text-right font-mono tabular-nums">{formatNumber(row.sharpe)}</td>
              <td className="text-right font-mono tabular-nums">{formatNumber(row.sortino)}</td>
              <td className="text-right font-mono tabular-nums text-rose-600">
                {formatPercent(row.maxDrawdown)}
                {(row.maxDrawdown ?? 0) > 0.25 ? (
                  <span className="ml-1 badge badge-warning badge-soft badge-xs">낙폭 점검</span>
                ) : null}
              </td>
              <td className={`text-right font-mono font-bold tabular-nums ${signedTextClass(row.benchmarkExcess)}`}>
                {formatPercent(row.benchmarkExcess)}
              </td>
              <td className="text-right">{objectiveBadge(row)}</td>
              <td className="text-right font-mono tabular-nums">{row.tradeCount?.toLocaleString('ko-KR') ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}

function kindLabel(kind: StrategyLeaderboardRow['kind']): string {
  if (kind === 'strategy') return '고유 전략';
  if (kind === 'oracle') return '상한선';
  return '벤치마크';
}

function kindBadgeClass(kind: StrategyLeaderboardRow['kind']): string {
  if (kind === 'strategy') return 'badge-primary badge-soft';
  if (kind === 'oracle') return 'badge-warning badge-soft';
  return 'badge-ghost';
}

function objectiveBadge(row: StrategyLeaderboardRow) {
  if (row.kind === 'benchmark') return <span className="badge badge-ghost badge-xs">기준선</span>;
  if (row.kind === 'oracle') return <span className="badge badge-warning badge-soft badge-xs">상한선</span>;
  if (row.objectivePassed) return <span className="badge badge-success badge-soft badge-xs">통과</span>;
  return <span className="badge badge-warning badge-soft badge-xs">미달</span>;
}

function formatNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return value.toFixed(2);
}
