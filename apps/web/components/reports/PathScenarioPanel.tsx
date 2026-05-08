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
  const maxAbsReturn = Math.max(0.01, ...rows.flatMap((row) => [Math.abs(row.currentReturn ?? 0), Math.abs(row.targetReturn ?? 0)]));
  const low = rows.find((row) => row.label === '발간 후 저점') ?? rows[0];
  const high = rows.find((row) => row.label === '발간 후 고점') ?? rows[3];
  const current = rows.find((row) => row.label === '현재가') ?? rows.at(-1);
  const currentPosition = Math.max(0, Math.min(1, current?.bandPosition ?? 0));
  const levelRows = rows.filter((row) => row.label !== '현재가');

  return (
    <div className="price-band-card">
      <div className="price-band-card__header">
        <div>
          <span className="badge badge-primary badge-soft badge-sm">관측 가격 레인지</span>
          <strong>{low?.basis ?? '—'} → {high?.basis ?? '—'}</strong>
        </div>
        <span className="badge badge-outline">{report.currency ?? '표시통화'}</span>
      </div>

      <div className="price-band">
        <div className="price-band__track" aria-label="발간 이후 관측 가격 레인지">
          <span className="price-band__fill" style={{ width: `${Math.round(currentPosition * 100)}%` }} />
          <span
            className="price-band__current-marker"
            style={{ left: `${Math.round(currentPosition * 100)}%` }}
            title={`현재가 ${current?.basis ?? '—'}`}
          />
        </div>
        <div className="price-band__axis">
          <span>저점 {low?.basis ?? '—'}</span>
          <span>고점 {high?.basis ?? '—'}</span>
        </div>
      </div>

      <div className="price-band__levels" aria-label="가격 분위 기준">
        {levelRows.map((row) => (
          <div key={`${row.label}-level`} className="price-band__level">
            <span>{priceBandLabel(row.label)}</span>
            <strong>{row.basis}</strong>
            <small>{row.point?.time ?? '—'}</small>
          </div>
        ))}
      </div>

      <div className="price-band__current-callout">
        <span>현재가 위치</span>
        <strong>{current?.basis ?? '—'}</strong>
        <small>{Math.round(currentPosition * 100)}% 지점 · {current?.point?.time ?? '—'}</small>
      </div>

      <div className="scenario-return-bars">
        {rows.map((row) => (
          <div className="scenario-return-bars__row" key={`${row.label}-bar`}>
            <span className="scenario-return-bars__label">{row.label}</span>
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
