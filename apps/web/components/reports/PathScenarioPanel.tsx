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
    <div className="path-observation-grid">
      <article className="panel path-scenario-panel">
        <h3>가격 레인지와 사후 수익률</h3>
        <p className="muted path-scenario-note">
          가격 기준 25%/75%는 발간 후 저점~고점 가격 범위를 4분위로 나눈 뒤, 해당 가격 수준에 가장 가까운 관측 종가를 사용합니다.
        </p>
        <PriceScenarioBand rows={scenarioRows} report={report} />
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
      </article>
      <TrendSignalCard trend={trend} report={report} />
    </div>
  );
}

function PriceScenarioBand({ rows, report }: { rows: ScenarioRow[]; report: ReportRow }) {
  const bandRows = rows.filter((row) => row.bandPosition !== null);
  const maxAbsReturn = Math.max(0.01, ...rows.flatMap((row) => [Math.abs(row.currentReturn ?? 0), Math.abs(row.targetReturn ?? 0)]));
  return (
    <div className="price-band-card">
      <div className="price-band">
        <div className="price-band__track" aria-label="발간 이후 관측 가격 레인지">
          {bandRows.map((row) => (
            <span
              key={row.label}
              className={`price-band__marker ${row.label === '현재가' ? 'current' : ''}`}
              style={{ left: `${Math.round((row.bandPosition ?? 0) * 100)}%` }}
              title={`${row.label} ${row.basis}`}
            >
              <span>{priceBandLabel(row.label)}</span>
            </span>
          ))}
        </div>
        <div className="price-band__axis">
          <span>{rows[0]?.basis ?? '—'}</span>
          <span>{rows[3]?.basis ?? '—'}</span>
        </div>
      </div>
      <div className="scenario-return-bars">
        {rows.map((row) => (
          <div className="scenario-return-bars__row" key={`${row.label}-bar`}>
            <span>{row.label}</span>
            <div className="return-bar">
              <i className={(row.currentReturn ?? 0) >= 0 ? 'good-bg' : 'bad-bg'} style={{ width: `${Math.max(3, Math.abs(row.currentReturn ?? 0) / maxAbsReturn * 100)}%` }} />
            </div>
            <strong className={(row.currentReturn ?? 0) >= 0 ? 'good' : 'bad'}>{formatPercent(row.currentReturn)}</strong>
          </div>
        ))}
      </div>
      <p className="muted price-band-card__footnote">
        모든 가격은 {report.currency} 기준입니다. 원화 환산은 포트폴리오 합산 검증에서만 보조로 사용합니다.
      </p>
    </div>
  );
}

function priceBandLabel(label: string): string {
  if (label === '25% 가격 수준') return '25%';
  if (label === '75% 가격 수준') return '75%';
  return label;
}
