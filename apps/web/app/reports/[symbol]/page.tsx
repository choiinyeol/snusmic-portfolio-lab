import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PriceEvidenceChart } from '@/components/charts/PriceEvidenceChart';
import { SymbolPersonaTrades } from '@/components/reports/SymbolPersonaTrades';
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
  type PricePoint,
  type ReportRow,
} from '@/lib/artifacts';
import { formatDays, formatNative, formatPercent } from '@/lib/format';

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
  const memo = buildKoreanInvestmentMemo(report);
  const personaLabels = Object.fromEntries(getSummaryRows().map((row) => [row.persona, row.label ?? row.persona]));
  const symbolEpisodes = getPositionEpisodes().filter((row) => row.symbol === report.symbol);
  const symbolTrades = getTrades().filter((row) => row.symbol === report.symbol);
  const status = targetStatus(report);

  return (
    <>
      <header className="page-header">
        <div className="page-header__eyebrow">리포트 분석 · Report dossier</div>
        <h1 className="page-header__title">{report.company}</h1>
        <p className="page-header__lede">
          {report.title || `${report.company} 리포트`}. 발간일 종가 {formatAssetPrice(report.entryPriceNative, report)} 대비
          목표가 {formatAssetPrice(report.targetPriceNative, report)} ({formatPercent(report.targetUpsideAtPub)} 업사이드)으로
          제시되었으며, 원화 환산은 성과·합산 검증에만 사용합니다.
        </p>
        <dl className="page-header__meta">
          <span className="page-header__meta-item"><dt>티커</dt><dd>{report.symbol}</dd></span>
          {report.exchange ? <span className="page-header__meta-item"><dt>거래소</dt><dd>{report.exchange}</dd></span> : null}
          <span className="page-header__meta-item"><dt>발간일</dt><dd>{report.publicationDate}</dd></span>
          {report.lastCloseDate ? <span className="page-header__meta-item"><dt>최근 종가일</dt><dd>{report.lastCloseDate}</dd></span> : null}
          <span className="page-header__meta-item"><dt>상태</dt><dd>{status.label}</dd></span>
        </dl>
        <div className="action-row" style={{ marginTop: '.75rem' }}>
          <Link className="terminal-link" href="/reports">← 리포트 아카이브</Link>
          {report.pdfUrl ? <a className="terminal-link" href={report.pdfUrl}>SMIC 원본 PDF</a> : null}
          <a className="terminal-link" href={githubBlobUrl(`data/markdown/${report.markdownFilename}`)}>GitHub Markdown</a>
        </div>
      </header>

      <Section
        eyebrow="Price evidence"
        title="가격 경로와 추출 목표가"
        caption="발간 1년 전부터의 가격 흐름과 함께, 발간 시점·목표 도달·관측 고점·관측 저점을 마커로 표시합니다."
      >
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <PriceEvidenceChart
            priceSeries={prices}
            targetPrice={report.targetPriceNative}
            currency={report.currency}
            publicationDate={report.publicationDate}
            targetHitDate={report.targetHitDate}
            evidenceMarkers={pathEvidence.markers}
          />
        </div>
      </Section>

      <Section
        eyebrow="Headline metrics"
        title="핵심 사후 지표"
        caption="발간일 종가, 추출 목표가, 현재 수익률, 목표 도달 상태를 한 줄에서 검증합니다."
      >
        <div className="grid bento-metrics">
          <KpiTile
            label="발간일 진입 종가"
            value={<span className="display-num">{formatAssetPrice(report.entryPriceNative, report)}</span>}
            caption={`${report.publicationDate} 기준`}
          />
          <KpiTile
            label="추출 목표가"
            value={<span className="display-num">{formatAssetPrice(report.targetPriceNative, report)}</span>}
            delta={`${formatPercent(report.targetUpsideAtPub)} 업사이드`}
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
        </div>
      </Section>

      <Section
        eyebrow="Path observations"
        title="시점별 매수 시나리오와 경로 통계"
        caption="발간 이후 구간의 분위 시점에서 매수했을 때의 사후 수익률과, 관측 구간의 고점·저점·중앙 통계를 동시에 검토합니다."
      >
        <div className="grid two-col">
          <article className="panel">
            <h3 style={{ marginBottom: '.45rem' }}>시점별 매수 사후 수익률</h3>
            <p className="muted" style={{ marginBottom: '.75rem', fontSize: '.85rem' }}>
              발간 이후 분위 시점·고점·저점·현재가에 매수했을 경우의 사후 결과입니다.
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>시점</th>
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
                      <td>{row.point?.time ?? '—'}</td>
                      <td className="num">{formatAssetPrice(row.point?.value, report)}</td>
                      <td className={`num ${(row.currentReturn ?? 0) >= 0 ? 'good' : 'bad'}`}>{formatPercent(row.currentReturn)}</td>
                      <td className={`num ${(row.targetReturn ?? 0) >= 0 ? 'good' : 'bad'}`}>{formatPercent(row.targetReturn)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="dossier-card">
            <span className="dossier-card__label">경로 통계</span>
            <dl className="definition-list">
              <dt>관측 고점</dt>
              <dd>{pathEvidence.peak ? `${formatAssetPrice(pathEvidence.peak.value, report)} (${pathEvidence.peak.time})` : '—'}</dd>
              <dt>관측 저점</dt>
              <dd>{pathEvidence.trough ? `${formatAssetPrice(pathEvidence.trough.value, report)} (${pathEvidence.trough.time})` : '—'}</dd>
              <dt>최고 수익률</dt>
              <dd className="good">{formatPercent(report.peakReturn)}</dd>
              <dt>최저 수익률</dt>
              <dd className="bad">{formatPercent(report.troughReturn)}</dd>
              <dt>최근 종가</dt>
              <dd>{formatAssetPrice(report.lastCloseNative, report)}</dd>
              <dt>최근 종가일</dt>
              <dd>{report.lastCloseDate ?? '—'}</dd>
            </dl>
          </article>
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

        <div className="grid two-col" style={{ marginTop: '1rem' }}>
          <article className="dossier-card">
            <span className="dossier-card__label">동일 티커 발간 이력</span>
            {siblingReports.length ? (
              <ul>
                {siblingReports.map((item) => (
                  <li key={item.reportId}>
                    <span className="muted" style={{ fontFamily: 'var(--mono)', fontSize: '.78rem' }}>{item.publicationDate}</span> · {item.title}
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

type PathEvidence = {
  peak: PricePoint | null;
  trough: PricePoint | null;
  markers: Array<{ time: string; kind: 'publication' | 'target-hit' | 'peak' | 'trough'; label: string; value?: number | null }>;
};

function buildPathEvidence(prices: PricePoint[], report: ReportRow): PathEvidence {
  const postPublication = prices.filter((point) => point.time >= report.publicationDate);
  const observed = postPublication.length ? postPublication : prices;
  const peak = observed.reduce<PricePoint | null>((best, point) => (!best || point.value > best.value ? point : best), null);
  const trough = observed.reduce<PricePoint | null>((best, point) => (!best || point.value < best.value ? point : best), null);
  const markers: PathEvidence['markers'] = [
    { time: report.publicationDate, kind: 'publication', label: '발간', value: report.entryPriceNative },
  ];
  if (report.targetHitDate) markers.push({ time: report.targetHitDate, kind: 'target-hit', label: '목표 도달', value: report.targetPriceNative });
  if (peak) markers.push({ time: peak.time, kind: 'peak', label: '관측 고점', value: peak.value });
  if (trough) markers.push({ time: trough.time, kind: 'trough', label: '관측 저점', value: trough.value });
  return { peak, trough, markers };
}

type ScenarioRow = { label: string; point: PricePoint | null; currentReturn: number | null; targetReturn: number | null };

function buildScenarioRows(prices: PricePoint[], report: ReportRow): ScenarioRow[] {
  const postPublication = prices.filter((point) => point.time >= report.publicationDate);
  if (!postPublication.length) {
    return ['발간 후 저점', '25% 경과', '75% 경과', '발간 후 고점', '현재가'].map((label) => ({ label, point: null, currentReturn: null, targetReturn: null }));
  }
  const low = postPublication.reduce((best, point) => point.value < best.value ? point : best, postPublication[0]);
  const high = postPublication.reduce((best, point) => point.value > best.value ? point : best, postPublication[0]);
  const q25 = postPublication[Math.floor((postPublication.length - 1) * 0.25)] ?? null;
  const q75 = postPublication[Math.floor((postPublication.length - 1) * 0.75)] ?? null;
  const current = postPublication.at(-1) ?? null;
  return [
    { label: '발간 후 저점', point: low },
    { label: '25% 경과', point: q25 },
    { label: '75% 경과', point: q75 },
    { label: '발간 후 고점', point: high },
    { label: '현재가', point: current },
  ].map((row) => ({
    ...row,
    currentReturn: row.point && current ? current.value / row.point.value - 1 : null,
    targetReturn: row.point && report.targetPriceNative ? report.targetPriceNative / row.point.value - 1 : null,
  }));
}

function oneYearBefore(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return date;
  const value = new Date(Date.UTC(year - 1, month - 1, day));
  return value.toISOString().slice(0, 10);
}

function buildKoreanInvestmentMemo(report: ReportRow) {
  const targetSentence = isBearishReport(report)
    ? report.targetHit
      ? `매도/회피 의견의 하락 목표가는 ${formatDays(report.daysToTarget)} 만에 도달했습니다.`
      : `매도/회피 의견이지만 하락 목표가에는 아직 도달하지 않았습니다.`
    : (report.targetUpsideAtPub ?? 0) <= 0
      ? '첫 거래 가능 가격이 목표가를 이미 넘어선 비실행 케이스로, 목표가 달성 통계에서는 제외됩니다.'
      : report.targetHit
        ? `목표가는 ${formatDays(report.daysToTarget)} 만에 도달해, 리포트의 단기 가격 근거가 실거래 경로에서 확인되었습니다.`
        : `현재 시점에서 목표가에는 도달하지 않았으며, 목표까지 남은 상승률은 ${formatPercent(targetRemaining(report))}입니다.`;
  const riskTone = (report.troughReturn ?? 0) < -0.2
    ? '발간 이후 하방 변동성이 컸기 때문에 분할 진입과 손실 제한 기준의 사전 검토가 권장됩니다.'
    : '관측 저점 기준 하방 훼손은 제한적이지만, 목표가 미도달 상태에서는 시간 비용을 함께 점검할 필요가 있습니다.';

  return {
    summary: `${report.company} 리포트는 발간일 종가 ${formatAssetPrice(report.entryPriceNative, report)} 대비 목표가 ${formatAssetPrice(report.targetPriceNative, report)}를 제시했습니다. ${targetSentence}`,
    bullets: [
      { label: '상승 여력', text: `발간 시점 목표 업사이드 ${formatPercent(report.targetUpsideAtPub)}, 관측 최고 수익률 ${formatPercent(report.peakReturn)}.` },
      { label: '리스크', text: `${riskTone} 관측 최저 수익률 ${formatPercent(report.troughReturn)}.` },
      { label: '현재 판단', text: `최근 종가 ${formatAssetPrice(report.lastCloseNative, report)} (${report.lastCloseDate ?? '날짜 없음'}), 현재 수익률 ${formatPercent(report.currentReturn)}.` },
    ],
  };
}

function formatAssetPrice(value: number | null | undefined, report: ReportRow): string {
  return formatNative(value, report.currency);
}

function targetStatus(report: ReportRow): { label: string; detail: string; tone: 'good' | 'warn' | 'bad' | 'accent' } {
  if (isBearishReport(report)) {
    return report.targetHit
      ? { label: '매도 적중', detail: `${report.targetHitDate} · ${formatDays(report.daysToTarget)}`, tone: 'good' }
      : { label: '매도 의견 진행', detail: '하락 목표가 미도달', tone: 'warn' };
  }
  if ((report.targetUpsideAtPub ?? 0) <= 0) {
    return { label: '비실행', detail: '첫 거래 가능 가격이 목표가 이상', tone: 'warn' };
  }
  return report.targetHit
    ? { label: '목표 도달', detail: `${report.targetHitDate} · ${formatDays(report.daysToTarget)}`, tone: 'good' }
    : { label: '진행 중', detail: `목표까지 ${formatPercent(targetRemaining(report))}`, tone: 'accent' };
}

function isBearishReport(report: ReportRow): boolean {
  return (report.targetUpsideAtPub ?? 0) < 0 && report.caveatFlags.some((flag) => /non_buy_rating:.*(sell|reduce|underperform|매도)/i.test(flag));
}

function targetRemaining(report: ReportRow): number | null {
  const target = report.targetPriceNative;
  const current = report.lastCloseNative;
  if (!target || !current || current <= 0) return null;
  return target / current - 1;
}

function githubBlobUrl(path: string): string {
  return `https://github.com/ChoiInYeol/snusmic-quant-terminal/blob/main/${encodeURI(path)}`;
}
