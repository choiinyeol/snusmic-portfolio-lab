import { DataTable } from '@/components/ui/DataTable';
import { TrendSignalCard } from '@/components/reports/TrendSignalCard';
import type { ReportRow } from '@/lib/artifacts';
import { formatPercent } from '@/lib/format';
import { formatAssetPrice, type ScenarioRow, type TrendSnapshot } from '@/lib/report-view-model';

type Props = {
  report: ReportRow;
  scenarioRows: ScenarioRow[];
  trend: TrendSnapshot;
};

export function PathScenarioPanel({ report, scenarioRows, trend }: Props) {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <article className="card border border-base-300 bg-base-100 shadow-sm lg:col-span-2">
        <div className="card-body gap-4 p-5">
          <header className="flex flex-col gap-1">
            <h3 className="text-lg font-bold tracking-tight">가격 레인지와 사후 수익률</h3>
            <p className="text-sm text-base-content/65">
              발간 후 저점~고점 가격 범위를 4분위로 나눠, 25%/75% 가격 수준에 가장 가까운 관측 종가를 사용합니다.
              모든 가격은 {report.currency} 기준입니다.
            </p>
          </header>
          <PriceScenarioCards rows={scenarioRows} report={report} />
          <ScenarioReturnBars rows={scenarioRows} />
          <DataTable compact>
            <thead>
              <tr>
                <th>가격 시나리오</th>
                <th>기준 가격</th>
                <th>일자</th>
                <th className="num">매수가</th>
                <th className="num">현재까지</th>
                <th className="num">목표까지</th>
              </tr>
            </thead>
            <tbody>
              {scenarioRows.map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td>{row.basis}</td>
                  <td>{row.point?.time ?? '—'}</td>
                  <td className="num">{formatAssetPrice(row.point?.value, report)}</td>
                  <td className={`num ${(row.currentReturn ?? 0) >= 0 ? 'good' : 'bad'}`}>{formatPercent(row.currentReturn)}</td>
                  <td className={`num ${(row.targetReturn ?? 0) >= 0 ? 'good' : 'bad'}`}>{formatPercent(row.targetReturn)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </div>
      </article>
      <TrendSignalCard trend={trend} report={report} />
    </div>
  );
}

function PriceScenarioCards({ rows, report }: { rows: ScenarioRow[]; report: ReportRow }) {
  const ordered = ['발간 후 저점', '25% 가격 수준', '75% 가격 수준', '발간 후 고점', '현재가']
    .map((label) => rows.find((row) => row.label === label))
    .filter((row): row is ScenarioRow => Boolean(row));
  if (ordered.length === 0) return null;
  return (
    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
      {ordered.map((row) => {
        const isCurrent = row.label === '현재가';
        return (
          <div
            key={row.label}
            className={`flex flex-col gap-1 rounded-lg border px-3 py-2.5 ${
              isCurrent ? 'border-primary/60 bg-primary/5' : 'border-base-300 bg-base-100'
            }`}
          >
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-base-content/55">
              {scenarioCardLabel(row.label)}
            </span>
            <strong className="text-base font-bold tabular-nums text-base-content">
              {formatAssetPrice(row.point?.value, report)}
            </strong>
            <small className="text-xs text-base-content/55">{row.point?.time ?? '—'}</small>
          </div>
        );
      })}
    </div>
  );
}

function ScenarioReturnBars({ rows }: { rows: ScenarioRow[] }) {
  const maxAbsReturn = Math.max(0.01, ...rows.flatMap((row) => [Math.abs(row.currentReturn ?? 0), Math.abs(row.targetReturn ?? 0)]));
  return (
    <div className="grid gap-1.5">
      {rows.map((row) => {
        const value = row.currentReturn ?? 0;
        const widthPct = Math.max(3, (Math.abs(value) / maxAbsReturn) * 100);
        return (
          <div key={`${row.label}-bar`} className="grid grid-cols-[7rem_1fr_4.5rem] items-center gap-3 text-sm">
            <span className="text-base-content/70">{row.label}</span>
            <div className="h-2 rounded-full bg-base-200">
              <div
                className={`h-full rounded-full ${value >= 0 ? 'bg-success' : 'bg-error'}`}
                style={{ width: `${widthPct}%` }}
              />
            </div>
            <strong className={`text-right tabular-nums ${value >= 0 ? 'text-success' : 'text-error'}`}>
              {formatPercent(row.currentReturn)}
            </strong>
          </div>
        );
      })}
    </div>
  );
}

function scenarioCardLabel(label: string): string {
  if (label === '25% 가격 수준') return '25%';
  if (label === '75% 가격 수준') return '75%';
  return label;
}
