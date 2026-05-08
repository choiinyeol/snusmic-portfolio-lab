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
              발간 후 저점~고점 구간을 4분위로 나눈 다섯 가격대입니다. 각 행의 % 는{' '}
              <strong>이 가격에서 매수했다면 거두었을 수익률</strong>이며, 가격은 {report.currency} 기준입니다.
            </p>
            <p className="text-xs text-base-content/55">
              · 회색 막대 <strong className="text-success">초록</strong>: 현재까지 수익률 ·{' '}
              <strong className="text-primary">파랑</strong>: 목표가까지 수익률
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
                  <td className={`num ${(row.currentReturn ?? 0) >= 0 ? 'good' : 'bad'}`}>
                    {formatPercent(row.currentReturn)}
                  </td>
                  <td className={`num ${(row.targetReturn ?? 0) >= 0 ? 'good' : 'bad'}`}>
                    {formatPercent(row.targetReturn)}
                  </td>
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
            {!isCurrent && (row.currentReturn !== null || row.targetReturn !== null) ? (
              <div className="mt-1 flex flex-col gap-0.5 text-xs">
                {row.currentReturn !== null ? (
                  <span className={(row.currentReturn ?? 0) >= 0 ? 'text-success' : 'text-error'}>
                    여기서 매수 → 현재 {formatPercent(row.currentReturn)}
                  </span>
                ) : null}
                {row.targetReturn !== null ? (
                  <span className={(row.targetReturn ?? 0) >= 0 ? 'text-primary' : 'text-error'}>
                    여기서 매수 → 목표 {formatPercent(row.targetReturn)}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function ScenarioReturnBars({ rows }: { rows: ScenarioRow[] }) {
  const maxAbs = Math.max(
    0.01,
    ...rows.flatMap((row) => [Math.abs(row.currentReturn ?? 0), Math.abs(row.targetReturn ?? 0)]),
  );
  return (
    <div className="grid gap-3">
      {rows.map((row) => (
        <div key={`${row.label}-bar`} className="grid gap-1">
          <span className="text-sm font-semibold text-base-content/70">{row.label}</span>
          <ScenarioBar label="현재까지" value={row.currentReturn} maxAbs={maxAbs} positiveTone="success" />
          <ScenarioBar label="목표가까지" value={row.targetReturn} maxAbs={maxAbs} positiveTone="primary" />
        </div>
      ))}
    </div>
  );
}

function ScenarioBar({
  label,
  value,
  maxAbs,
  positiveTone,
}: {
  label: string;
  value: number | null;
  maxAbs: number;
  positiveTone: 'success' | 'primary';
}) {
  if (value === null) {
    return (
      <div className="grid grid-cols-[5rem_1fr_4.5rem] items-center gap-3 text-xs text-base-content/55">
        <span>{label}</span>
        <div className="h-1.5 rounded-full bg-base-200" />
        <span className="text-right">—</span>
      </div>
    );
  }
  const widthPct = Math.max(2, (Math.abs(value) / maxAbs) * 100);
  const positiveClass = positiveTone === 'success' ? 'bg-success' : 'bg-primary';
  const positiveText = positiveTone === 'success' ? 'text-success' : 'text-primary';
  const tone = value >= 0 ? positiveClass : 'bg-error';
  const text = value >= 0 ? positiveText : 'text-error';
  return (
    <div className="grid grid-cols-[5rem_1fr_4.5rem] items-center gap-3 text-xs">
      <span className="text-base-content/60">{label}</span>
      <div className="h-1.5 rounded-full bg-base-200">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${widthPct}%` }} />
      </div>
      <strong className={`text-right tabular-nums ${text}`}>{formatPercent(value)}</strong>
    </div>
  );
}

function scenarioCardLabel(label: string): string {
  if (label === '25% 가격 수준') return '25%';
  if (label === '75% 가격 수준') return '75%';
  return label;
}
