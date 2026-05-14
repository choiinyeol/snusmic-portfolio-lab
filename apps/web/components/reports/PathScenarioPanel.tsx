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
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
        <header className="mb-4 flex flex-col gap-1 border-b border-slate-100 pb-3">
          <h3 className="text-base font-semibold tracking-tight text-slate-950">가격대별 사후 수익률</h3>
          <p className="text-sm leading-6 text-slate-600">
            발간 후 고점·저점·분위 가격에서 샀다면 현재까지 얼마를 벌거나 잃었는지 봅니다. “목표가 적중”보다 실제 진입
            타이밍의 비용을 보여주는 영역입니다.
          </p>
        </header>
        <PriceScenarioCards rows={scenarioRows} report={report} />
        <ScenarioReturnBars rows={scenarioRows} />
        <div className="mt-4">
          <DataTable compact>
            <thead>
              <tr>
                <th>가격 시나리오</th>
                <th>기준</th>
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
  const ordered = ['발간 후 고점', '75% 가격 수준', '25% 가격 수준', '발간 후 저점', '현재가']
    .map((label) => rows.find((row) => row.label === label))
    .filter((row): row is ScenarioRow => Boolean(row));
  if (ordered.length === 0) return null;
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
      {ordered.map((row) => {
        const isCurrent = row.label === '현재가';
        return (
          <div
            key={row.label}
            className={`min-w-0 rounded-lg border px-3 py-2.5 ${
              isCurrent ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-slate-50 text-slate-950'
            }`}
          >
            <span className={`text-xs font-medium ${isCurrent ? 'text-white/60' : 'text-slate-500'}`}>
              {scenarioCardLabel(row.label)}
            </span>
            <strong className="mt-1 block truncate font-mono text-base font-semibold tabular-nums">
              {formatAssetPrice(row.point?.value, report)}
            </strong>
            <small className={`text-xs ${isCurrent ? 'text-white/60' : 'text-slate-500'}`}>
              {row.point?.time ?? '—'}
            </small>
          </div>
        );
      })}
    </div>
  );
}

function ScenarioReturnBars({ rows }: { rows: ScenarioRow[] }) {
  const ordered = ['발간 후 고점', '75% 가격 수준', '25% 가격 수준', '발간 후 저점', '현재가']
    .map((label) => rows.find((row) => row.label === label))
    .filter((row): row is ScenarioRow => Boolean(row));
  const maxAbs = Math.max(
    0.01,
    ...ordered.flatMap((row) => [Math.abs(row.currentReturn ?? 0), Math.abs(row.targetReturn ?? 0)]),
  );
  return (
    <div className="mt-4 grid gap-3">
      {ordered.map((row) => (
        <div key={`${row.label}-bar`} className="grid gap-1">
          <span className="text-xs font-medium text-slate-500">{row.label}</span>
          <ScenarioBar label="현재까지" value={row.currentReturn} maxAbs={maxAbs} positiveTone="emerald" />
          <ScenarioBar label="목표가까지" value={row.targetReturn} maxAbs={maxAbs} positiveTone="blue" />
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
  positiveTone: 'emerald' | 'blue';
}) {
  if (value === null) {
    return (
      <div className="grid grid-cols-[5rem_1fr_4.5rem] items-center gap-3 text-xs text-slate-500">
        <span>{label}</span>
        <div className="h-1.5 rounded-full bg-slate-100" />
        <span className="text-right">—</span>
      </div>
    );
  }
  const widthPct = Math.max(2, (Math.abs(value) / maxAbs) * 100);
  const tone = value >= 0 ? (positiveTone === 'emerald' ? 'bg-emerald-500' : 'bg-blue-500') : 'bg-red-500';
  const text = value >= 0 ? (positiveTone === 'emerald' ? 'text-emerald-600' : 'text-blue-600') : 'text-red-600';
  return (
    <div className="grid grid-cols-[5rem_1fr_4.5rem] items-center gap-3 text-xs">
      <span className="text-slate-500">{label}</span>
      <div className="h-1.5 rounded-full bg-slate-100">
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
