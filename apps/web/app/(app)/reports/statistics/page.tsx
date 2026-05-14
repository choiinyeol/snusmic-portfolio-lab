import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { PageHero } from '@/components/ui/PageHero';
import { Section } from '@/components/ui/Section';
import { getDataQuality, getOverview, getReportRows, type ReportRow } from '@/lib/artifacts';
import { buildReportStats } from '@/lib/product-model';
import { formatDateKo, formatDays, formatPercent } from '@/lib/format';

export default function ReportStatisticsPage() {
  const reports = getReportRows();
  const stats = buildReportStats(reports);
  const quality = getDataQuality();
  const overview = getOverview();
  const extractedReports = overview.report_counts?.extracted_reports ?? quality.extractedReports;
  const visibleReports = overview.report_counts?.web_report_rows ?? stats.total;
  const excludedReports = extractedReports - visibleReports;
  const currentReturns = reports.map((report) => report.currentReturn).filter(isFiniteNumber);
  const hitRows = reports.filter((report) => report.targetHit);
  const activeRows = reports.filter(
    (report) => !report.targetHit && !report.expired && (report.targetUpsideAtPub ?? 0) > 0,
  );
  const deepLosers = reports.filter((report) => (report.currentReturn ?? 0) <= -0.2);
  const nearTarget = activeRows.filter(
    (report) =>
      (report.targetProgressPct ?? 0) >= 0.8 || (report.targetRemainingPct ?? Number.POSITIVE_INFINITY) <= 0.1,
  );
  const positivePValue = twoSidedBinomialNormalPValue(stats.positiveReturnCount, stats.total, 0.5);
  const returnBuckets = bucketize(reports, [
    { label: '-20% 이하', test: (report) => (report.currentReturn ?? 0) <= -0.2 },
    { label: '-20~-5%', test: (report) => between(report.currentReturn, -0.2, -0.05) },
    { label: '-5~0%', test: (report) => between(report.currentReturn, -0.05, 0) },
    { label: '0~20%', test: (report) => between(report.currentReturn, 0, 0.2) },
    { label: '20% 이상', test: (report) => (report.currentReturn ?? Number.NEGATIVE_INFINITY) >= 0.2 },
  ]);
  const hitDayBuckets = bucketize(hitRows, [
    { label: '20일 이하', test: (report) => (report.daysToTarget ?? Number.POSITIVE_INFINITY) <= 20 },
    { label: '21~60일', test: (report) => between(report.daysToTarget, 21, 60, true) },
    { label: '61~120일', test: (report) => between(report.daysToTarget, 61, 120, true) },
    { label: '121~240일', test: (report) => between(report.daysToTarget, 121, 240, true) },
    { label: '240일 초과', test: (report) => (report.daysToTarget ?? 0) > 240 },
  ]);
  const progressBuckets = bucketize(activeRows, [
    { label: '0~25%', test: (report) => between(report.targetProgressPct, 0, 0.25) },
    { label: '25~50%', test: (report) => between(report.targetProgressPct, 0.25, 0.5) },
    { label: '50~75%', test: (report) => between(report.targetProgressPct, 0.5, 0.75) },
    { label: '75% 이상', test: (report) => (report.targetProgressPct ?? 0) >= 0.75 },
  ]);
  const bestReturns = [...reports]
    .filter((report) => isFiniteNumber(report.currentReturn))
    .sort((a, b) => (b.currentReturn ?? 0) - (a.currentReturn ?? 0))
    .slice(0, 6);
  const worstReturns = [...reports]
    .filter((report) => isFiniteNumber(report.currentReturn))
    .sort((a, b) => (a.currentReturn ?? 0) - (b.currentReturn ?? 0))
    .slice(0, 6);

  return (
    <>
      <PageHero
        eyebrow="리포트 통계"
        title="통계"
        subtitle="목표가 도달률, 현재 수익률 분포, 도달 소요일, 검토 후보를 실제 리포트 표본으로 다시 계산합니다. 숫자는 매수 신호가 아니라 다음 규칙을 만들기 전에 확인해야 할 증거입니다."
        badges={[
          { label: '검증 표본', value: `${stats.total.toLocaleString('ko-KR')}건` },
          { label: '목표 도달', value: `${stats.hitCount.toLocaleString('ko-KR')}건` },
          { label: '현재 플러스', value: `${stats.positiveReturnCount.toLocaleString('ko-KR')}건` },
          { label: '최신 발간', value: formatDateKo(stats.latestPublicationDate) },
          { label: '제외', value: `${excludedReports.toLocaleString('ko-KR')}건` },
        ]}
        actions={
          <>
            <Button asChild size="sm" variant="secondary">
              <Link href="/reports">리포트 표</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/reports/validation">검증 방법</Link>
            </Button>
          </>
        }
      />

      <Section
        eyebrow="요약"
        title="먼저 볼 숫자"
        caption="평균만 보면 일부 대형 수익 표본이 전체 실력을 과장할 수 있으므로, 중앙값·분포·표본 수를 함께 둡니다."
      >
        <div className="grid overflow-hidden rounded-xl border border-slate-200 bg-white md:grid-cols-4">
          <MetricCard
            label="목표가 도달률"
            value={formatPercent(stats.targetHitRate)}
            caption={`${stats.hitCount}/${stats.total}건`}
          />
          <MetricCard
            label="현재 플러스"
            value={formatPercent(stats.positiveReturnRate)}
            caption={`p≈${positivePValue.toFixed(2)} vs 50%`}
          />
          <MetricCard
            label="평균 현재 수익률"
            value={formatPercent(stats.averageCurrentReturn)}
            caption={`중앙값 ${formatPercent(stats.medianCurrentReturn)}`}
          />
          <MetricCard
            label="도달 중앙일"
            value={formatDays(stats.medianDaysToTarget)}
            caption={`도달 표본 ${hitRows.length}건`}
          />
        </div>
        <Narrative>
          현재 표본에서 목표가에 도달한 리포트는 {stats.hitCount.toLocaleString('ko-KR')}건이고, 현재 수익률이 0% 이상인
          표본은 {stats.positiveReturnCount.toLocaleString('ko-KR')}건입니다. 현재 플러스 비율은 50% 기준의 단순
          부호검정에서 강한 우위로 보기 어렵습니다. 대신 평균 현재 수익률 {formatPercent(stats.averageCurrentReturn)}와
          중앙값 {formatPercent(stats.medianCurrentReturn)}의 차이가 크기 때문에, 이 데이터는 “전체가 고르게 맞았다”보다
          “소수의 큰 승자와 손실 군집이 함께 존재한다”는 해석이 더 안전합니다.
        </Narrative>
      </Section>

      <Section eyebrow="분포" title="현재 수익률과 목표 도달 시간">
        <div className="grid gap-4 lg:grid-cols-2">
          <DistributionPanel title="현재 수익률 분포" rows={returnBuckets} total={currentReturns.length} />
          <DistributionPanel title="목표 도달 소요일" rows={hitDayBuckets} total={hitRows.length} />
        </div>
        <Narrative>
          손실 표본은 평균 뒤에 숨기면 안 됩니다. 현재 -20% 이하 손실 군집은 {deepLosers.length.toLocaleString('ko-KR')}
          건이고, 목표에 닿은 표본의 중앙 도달 시간은 {formatDays(stats.medianDaysToTarget)}입니다. 따라서 “발간 직후
          무조건 매수”나 “목표가 도달 즉시 매도” 같은 규칙은 별도 대기기간·사후 보유 artifact가 생기기 전까지 결론으로
          노출하지 않습니다.
        </Narrative>
      </Section>

      <Section eyebrow="후보" title="검토 후보는 별도 페이지가 아니라 같은 표의 다른 정렬입니다">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <DistributionPanel title="진행 중 표본의 목표 진행률" rows={progressBuckets} total={activeRows.length} />
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs font-medium text-slate-500">목표 근접</div>
            <div className="mt-2 font-mono text-3xl font-semibold tabular-nums text-slate-950">
              {nearTarget.length.toLocaleString('ko-KR')}
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              진행 중 표본 중 목표 진행률 80% 이상 또는 목표 잔여 변화율 10% 이하인 리포트입니다. 이 숫자가 적으면 후보
              페이지를 따로 두기보다 리포트 표에서 정렬로 확인하는 편이 낫습니다.
            </p>
            <Button asChild className="mt-4 w-full" size="sm" variant="outline">
              <Link href="/reports">통합 표에서 정렬하기</Link>
            </Button>
          </div>
        </div>
      </Section>

      <Section eyebrow="표본" title="수익 상·하위 리포트">
        <div className="grid gap-4 lg:grid-cols-2">
          <ReportList title="상위 수익률" reports={bestReturns} />
          <ReportList title="하위 수익률" reports={worstReturns} />
        </div>
      </Section>
    </>
  );
}

function MetricCard({ label, value, caption }: { label: string; value: string; caption: string }) {
  return (
    <div className="border-b border-slate-100 p-4 last:border-b-0 md:border-r md:border-b-0 md:last:border-r-0">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-slate-950">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{caption}</div>
    </div>
  );
}

function Narrative({ children }: { children: ReactNode }) {
  return <p className="max-w-5xl text-sm leading-7 text-slate-700">{children}</p>;
}

type BucketRow = { label: string; count: number };

function DistributionPanel({ title, rows, total }: { title: string; rows: BucketRow[]; total: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      <div className="mt-4 grid gap-3">
        {rows.map((row) => {
          const share = total > 0 ? row.count / total : 0;
          return (
            <div className="grid gap-1" key={row.label}>
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-slate-600">{row.label}</span>
                <span className="font-mono font-semibold tabular-nums text-slate-950">
                  {row.count.toLocaleString('ko-KR')} · {formatPercent(share)}
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-slate-950" style={{ width: `${Math.max(2, share * 100)}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReportList({ title, reports }: { title: string; reports: ReportRow[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-950">{title}</div>
      <div className="divide-y divide-slate-100">
        {reports.map((report) => (
          <Link
            className="grid gap-2 px-4 py-3 transition-colors hover:bg-slate-50 sm:grid-cols-[minmax(0,1fr)_7rem_7rem] sm:items-center"
            href={`/reports/${encodeURIComponent(report.symbol)}`}
            key={report.reportId}
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-950">{report.company || report.symbol}</div>
              <div className="mt-1 truncate font-mono text-xs text-slate-500">
                {report.symbol} · {formatDateKo(report.publicationDate)}
              </div>
            </div>
            <div className="font-mono text-sm font-semibold tabular-nums text-slate-950 sm:text-right">
              {formatPercent(report.currentReturn)}
            </div>
            <div className="font-mono text-xs tabular-nums text-slate-500 sm:text-right">
              목표 {report.targetHit ? '도달' : formatPercent(report.targetProgressPct)}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function bucketize<T>(rows: T[], buckets: Array<{ label: string; test: (row: T) => boolean }>): BucketRow[] {
  return buckets.map((bucket) => ({ label: bucket.label, count: rows.filter(bucket.test).length }));
}

function between(value: number | null | undefined, low: number, high: number, inclusiveInteger = false): boolean {
  if (!isFiniteNumber(value)) return false;
  if (inclusiveInteger) return value >= low && value <= high;
  return value >= low && value < high;
}

function twoSidedBinomialNormalPValue(successes: number, total: number, p = 0.5): number {
  if (total <= 0) return 1;
  const variance = total * p * (1 - p);
  if (variance <= 0) return 1;
  const z = Math.abs((successes - total * p) / Math.sqrt(variance));
  return Math.min(1, 2 * (1 - normalCdf(z)));
}

function normalCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const abs = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * abs);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-abs * abs);
  return sign * y;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
