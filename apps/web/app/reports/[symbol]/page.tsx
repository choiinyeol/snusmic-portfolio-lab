import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PriceEvidenceChart } from '@/components/charts/PriceEvidenceChart';
import { SymbolPersonaTrades } from '@/components/reports/SymbolPersonaTrades';
import { DataTable } from '@/components/ui/DataTable';
import { KpiTile } from '@/components/ui/KpiTile';
import { Section } from '@/components/ui/Section';
import {
  getMarkdownSnippet,
  getPositionEpisodes,
  getPriceSeries,
  getReportBySymbol,
  getReportRows,
  getReportsBySymbol,
  getSummaryRows,
  getTrades,
} from '@/lib/artifacts';
import { formatPercent } from '@/lib/format';
import {
  buildKoreanInvestmentMemo,
  buildPathEvidence,
  buildScenarioRows,
  buildTrendSnapshot,
  formatAssetPrice,
  oneYearBefore,
  reportEntryPrice,
  targetMoveLabel,
  targetStatus,
} from '@/lib/report-view-model';

type ReportParams = Promise<{ symbol: string }>;

export function generateStaticParams() {
  return Array.from(new Set(getReportRows().map((report) => report.symbol))).map((symbol) => ({ symbol }));
}

export async function generateMetadata({ params }: { params: ReportParams }): Promise<Metadata> {
  const { symbol } = await params;
  const report = getReportBySymbol(decodeURIComponent(symbol));
  return { title: report ? `${report.company} — 리포트 분석` : '리포트 분석' };
}

export default async function ReportDetailPage({ params }: { params: ReportParams }) {
  const { symbol } = await params;
  const reportSymbol = decodeURIComponent(symbol);
  const report = getReportBySymbol(reportSymbol);
  if (!report) notFound();
  const siblingReports = getReportsBySymbol(reportSymbol);
  const prices = getPriceSeries(report.symbol, oneYearBefore(report.publicationDate), report.lastCloseDate);
  const snippet = getMarkdownSnippet(report);
  const pathEvidence = buildPathEvidence(prices, report);
  const scenarioRows = buildScenarioRows(prices, report);
  const trendSnapshot = buildTrendSnapshot(prices, report);
  const memo = buildKoreanInvestmentMemo(report);
  const personaLabels = Object.fromEntries(getSummaryRows().map((row) => [row.persona, row.label ?? row.persona]));
  const symbolEpisodes = getPositionEpisodes().filter((row) => row.symbol === report.symbol);
  const symbolTrades = getTrades().filter((row) => row.symbol === report.symbol);
  const status = targetStatus(report);

  return (
    <>
      <header className="page-header">
        <div className="report-hero-compact">
          <div>
            <div className="page-header__eyebrow">Report dossier</div>
            <h1 className="page-header__title">{report.company}</h1>
            <p className="page-header__lede report-hero-compact__lede">
              {report.title || `${report.company} 리포트`} · 발간가 {formatAssetPrice(reportEntryPrice(report), report)} → 목표가 {formatAssetPrice(report.targetPriceNative, report)}
              <strong> {formatPercent(report.targetUpsideAtPub)} {targetMoveLabel(report)}</strong>
            </p>
          </div>
          <div className="report-hero-compact__actions">
            <Link className="terminal-link" href="/reports">← 아카이브</Link>
            {report.pdfUrl ? <a className="terminal-link" href={report.pdfUrl}>원본 PDF</a> : null}
            <a className="terminal-link" href={githubBlobUrl(`data/markdown/${report.markdownFilename}`)}>Markdown</a>
          </div>
        </div>
        <dl className="page-header__meta report-hero-chips">
          <span className="page-header__meta-item"><dt>티커</dt><dd>{report.symbol}</dd></span>
          {report.exchange ? <span className="page-header__meta-item"><dt>거래소</dt><dd>{report.exchange}</dd></span> : null}
          <span className="page-header__meta-item"><dt>통화</dt><dd>{report.currency}</dd></span>
          <span className="page-header__meta-item"><dt>발간일</dt><dd>{report.publicationDate}</dd></span>
          {report.lastCloseDate ? <span className="page-header__meta-item"><dt>최근 종가일</dt><dd>{report.lastCloseDate}</dd></span> : null}
          <span className="page-header__meta-item"><dt>상태</dt><dd>{status.label}</dd></span>
        </dl>
      </header>

      <Section
        eyebrow="Price evidence"
        title="가격 경로와 추출 목표가"
        caption="차트는 자산의 표시 통화 그대로 보여주고, 목표가·관측 고저점·현재가를 한 화면에서 검증합니다."
      >
        <div className="report-evidence-grid">
          <div className="panel report-chart-panel">
            <PriceEvidenceChart
              priceSeries={prices}
              targetPrice={report.targetPriceNative}
              currency={report.currency}
              publicationDate={report.publicationDate}
              targetHitDate={report.targetHitDate}
              evidenceMarkers={pathEvidence.markers}
            />
          </div>
          <aside className="report-side-rail" aria-label="리포트 핵심 가격 지표">
            <KpiTile
              label="발간일 진입 종가"
              value={<span className="display-num">{formatAssetPrice(reportEntryPrice(report), report)}</span>}
              caption={`${report.publicationDate} 기준`}
            />
            <KpiTile
              label="추출 목표가"
              value={<span className="display-num">{formatAssetPrice(report.targetPriceNative, report)}</span>}
              delta={`${formatPercent(report.targetUpsideAtPub)} ${targetMoveLabel(report)}`}
              tone="accent"
            />
            <KpiTile
              label="현재 수익률"
              value={<span className="display-num">{formatPercent(report.currentReturn)}</span>}
              delta={`최근 종가 ${formatAssetPrice(report.lastCloseNative, report)}`}
              tone={(report.currentReturn ?? 0) >= 0 ? 'good' : 'bad'}
            />
            <KpiTile
              label="목표 상태"
              value={status.label}
              delta={status.detail}
              tone={status.tone}
            />
            <article className="dossier-card report-rail-card">
              <span className="dossier-card__label">Path range</span>
              <dl className="definition-list">
                <dt>관측 고점</dt>
                <dd>{pathEvidence.peak ? `${formatAssetPrice(pathEvidence.peak.value, report)} (${pathEvidence.peak.time})` : '—'}</dd>
                <dt>관측 저점</dt>
                <dd>{pathEvidence.trough ? `${formatAssetPrice(pathEvidence.trough.value, report)} (${pathEvidence.trough.time})` : '—'}</dd>
                <dt>최근 종가</dt>
                <dd>{formatAssetPrice(report.lastCloseNative, report)}</dd>
                <dt>최근 종가일</dt>
                <dd>{report.lastCloseDate ?? '—'}</dd>
              </dl>
            </article>
          </aside>
        </div>
      </Section>

      <Section
        eyebrow="Path observations"
        title="가격대별 매수 시나리오와 추세 신호"
        caption="발간 이후 시간 경과가 아니라, 관측 저점~고점 사이의 가격 수준과 추세 지표를 함께 비교합니다."
      >
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

          <TrendSignalCard trend={trendSnapshot} report={report} />
        </div>
      </Section>

      <Section
        eyebrow="Trades"
        title="페르소나별 매매 기록"
        caption="해당 종목에 대해 각 전략이 언제 진입하고, 언제 청산했는지 체결 단위로 검토합니다."
      >
        <SymbolPersonaTrades
          symbol={report.symbol}
          episodes={symbolEpisodes}
          trades={symbolTrades}
          personaLabels={personaLabels}
        />
      </Section>

      <Section
        eyebrow="Sources"
        title="원문과 메타 정보"
        caption="투자 메모, 추출된 마크다운 발췌, 동일 종목의 다른 발간 이력을 함께 제공합니다."
      >
        <div className="grid two-col">
          <article className="dossier-card">
            <span className="dossier-card__label">투자 메모</span>
            <p>{memo.summary}</p>
            <ul>
              {memo.bullets.map((item) => (
                <li key={item.label}><strong>{item.label}.</strong> {item.text}</li>
              ))}
            </ul>
          </article>

          <article className="dossier-card">
            <span className="dossier-card__label">추출 마크다운</span>
            <div className="markdown-snippet">{snippet}</div>
          </article>
        </div>

        <div className="grid two-col source-history-grid">
          <article className="dossier-card">
            <span className="dossier-card__label">동일 티커 발간 이력</span>
            {siblingReports.length ? (
              <ul>
                {siblingReports.map((item) => (
                  <li key={item.reportId}>
                    <span className="muted source-date">{item.publicationDate}</span> · {item.title}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">해당 티커의 다른 SMIC 리포트는 아카이브에 없습니다.</p>
            )}
          </article>

          <article className="dossier-card">
            <span className="dossier-card__label">원본 자료</span>
            <ul>
              <li><a href={githubBlobUrl(`data/markdown/${report.markdownFilename}`)}>GitHub Markdown</a></li>
              {report.pdfFilename ? <li><a href={githubBlobUrl(`data/pdfs/${report.pdfFilename}`)}>GitHub PDF</a></li> : null}
              {report.pdfUrl ? <li><a href={report.pdfUrl}>SMIC 원본 PDF</a></li> : null}
            </ul>
          </article>
        </div>
      </Section>
    </>
  );
}

type ScenarioRows = ReturnType<typeof buildScenarioRows>;
type TrendSnapshot = ReturnType<typeof buildTrendSnapshot>;
type Report = NonNullable<ReturnType<typeof getReportBySymbol>>;

function PriceScenarioBand({ rows, report }: { rows: ScenarioRows; report: Report }) {
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

function TrendSignalCard({ trend, report }: { trend: TrendSnapshot; report: Report }) {
  return (
    <article className="dossier-card trend-signal-card">
      <span className="dossier-card__label">Trend following</span>
      <div className={`trend-verdict tone-${trend.tone}`}>
        <strong>{trend.verdict}</strong>
        <p>{trend.detail}</p>
      </div>
      <div className="trend-ma-grid">
        {trend.movingAverages.map((ma) => (
          <div key={ma.label} className="trend-ma">
            <span>{ma.label}</span>
            <strong>{formatAssetPrice(ma.value, report)}</strong>
            <em className={(ma.distance ?? 0) >= 0 ? 'good' : 'bad'}>{formatPercent(ma.distance)}</em>
          </div>
        ))}
      </div>
      <dl className="trend-metric-list">
        {trend.metrics.map((metric) => (
          <div key={metric.label}>
            <dt>{metric.label}</dt>
            <dd className={metric.tone ? metric.tone === 'good' ? 'good' : metric.tone === 'bad' ? 'bad' : 'warn' : ''}>{metric.value}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

function githubBlobUrl(path: string): string {
  return `https://github.com/ChoiInYeol/snusmic-quant-terminal/blob/main/${encodeURI(path)}`;
}
