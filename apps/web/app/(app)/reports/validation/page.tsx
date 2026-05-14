import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PageHero } from '@/components/ui/PageHero';
import { Section } from '@/components/ui/Section';
import { getDataQuality, getOverview, getReportRows } from '@/lib/artifacts';
import { formatDays, formatPercent } from '@/lib/format';
import { buildReportStats } from '@/lib/product-model';

export default function ReportValidationPage() {
  const reports = getReportRows();
  const overview = getOverview();
  const quality = getDataQuality();
  const stats = buildReportStats(reports);
  const extractedReports = overview.report_counts?.extracted_reports ?? quality.extractedReports;
  const visibleReports = overview.report_counts?.web_report_rows ?? stats.total;
  const priceMatchedReports = overview.report_counts?.price_matched_reports ?? visibleReports;
  const excludedReports =
    overview.report_counts?.excluded_reports ??
    quality.reportExclusions.excluded_reports ??
    Math.max(0, extractedReports - visibleReports);
  const missingPriceRows =
    overview.report_counts?.excluded_missing_price ?? quality.reportExclusions.missing_price ?? 0;
  const sellOpinionRows = overview.report_counts?.excluded_sell_opinion ?? quality.reportExclusions.sell_opinion ?? 0;
  const nonExecutableRows =
    (overview.report_counts?.excluded_non_positive_upside ?? quality.reportExclusions.non_positive_upside ?? 0) +
    (overview.report_counts?.excluded_downside_target ?? quality.reportExclusions.downside_target ?? 0) +
    (overview.report_counts?.excluded_instant_target_hit ?? quality.reportExclusions.instant_target_hit ?? 0);

  return (
    <div className="grid gap-6">
      <PageHero
        eyebrow="검증 방법"
        title="목표가 검증을 어떻게 읽을까"
        subtitle="목표가 적중률, 현재 플러스, 평균 진행률 같은 숫자는 헤더 장식이 아니라 표본 정의와 제외 규칙을 같이 봐야 의미가 있습니다. 이 페이지는 리포트 통계를 판단 지표로 해석하기 위한 설명서입니다."
        badges={[
          { label: '검증 표본', value: `${visibleReports.toLocaleString('ko-KR')}건` },
          { label: '전체 추출', value: `${extractedReports.toLocaleString('ko-KR')}건` },
          {
            label: '가격 매칭',
            value: formatPercent(extractedReports > 0 ? priceMatchedReports / extractedReports : null),
          },
          { label: '제외', value: `${excludedReports.toLocaleString('ko-KR')}건` },
        ]}
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/reports">리포트 표로 돌아가기</Link>
          </Button>
        }
      />

      <Section
        eyebrow="핵심 해석"
        title="숫자 하나보다 표본 정의가 먼저입니다"
        caption="이 통계는 추천이나 주문 신호가 아니라, 서울대 동아리 리서치가 발간 이후 실제 가격 경로에서 얼마나 검증됐는지 보는 사후 검증 도구입니다."
      >
        <div className="grid gap-3 lg:grid-cols-3">
          <InsightBlock
            title="목표가 적중률"
            value={formatPercent(stats.targetHitRate)}
            body={`${stats.hitCount.toLocaleString('ko-KR')}건이 목표가에 닿았습니다. 단, 가격 데이터가 없거나 애초에 실행하기 어려운 리포트는 분모에서 제외합니다.`}
          />
          <InsightBlock
            title="현재 플러스"
            value={formatPercent(stats.positiveReturnRate)}
            body={`${stats.positiveReturnCount.toLocaleString('ko-KR')}건은 최근 가격 기준 수익권입니다. 목표가에 닿지 않아도 손실인지 이익인지는 별도로 봐야 합니다.`}
          />
          <InsightBlock
            title="목표 도달 시간"
            value={formatDays(stats.medianDaysToTarget)}
            body={`평균은 ${formatDays(overview.target_stats?.avg_days_to_target)}이고 중앙값은 ${formatDays(stats.medianDaysToTarget)}입니다. 평균이 길면 몇몇 늦은 도달 사례가 전체를 끌어올렸다는 뜻입니다.`}
          />
        </div>
      </Section>

      <Section eyebrow="계산식" title="화면의 통계는 이렇게 계산합니다">
        <div className="grid gap-3 lg:grid-cols-2">
          <Formula title="목표 진행률" formula="(현재가 − 발간가) / (목표가 − 발간가)">
            상승 목표 리포트에서 현재 가격이 목표가까지 얼마나 이동했는지 보는 값입니다. 목표가에 닿으면 100%로
            표시하고, 발간가 아래로 내려가면 0%에 가깝게 보입니다.
          </Formula>
          <Formula title="현재 수익률" formula="최근 종가 / 발간가 − 1">
            목표가와 무관하게 리포트를 발간일 종가에 샀다고 가정했을 때의 현재 손익입니다. 만료 리포트는 만료일 가격을
            기준으로 최종 수익률을 계산합니다.
          </Formula>
          <Formula title="가격 매칭률" formula="가격이 연결된 리포트 / 전체 추출 리포트">
            리포트에서 티커와 가격 시계열을 연결할 수 있었는지 보는 데이터 품질 지표입니다. 이 값은 투자 성과가 아니라
            검증 가능한 표본의 비중입니다.
          </Formula>
          <Formula title="검증 제외" formula="가격 없음 + 매도 의견 + 비실행 표본">
            가격이 없거나, 첫 거래 가능 시점에 이미 목표가를 넘어선 표본처럼 같은 조건으로 비교하기 어려운 사례입니다.
            제외는 성과를 좋게 보이게 하려는 장식이 아니라 분모를 깨끗하게 만드는 작업입니다.
          </Formula>
        </div>
      </Section>

      <Section eyebrow="제외 사유" title="왜 19건은 표에서 빠졌나">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <dl className="divide-y divide-slate-100">
            <Reason label="가격 없음" value={`${missingPriceRows.toLocaleString('ko-KR')}건`}>
              티커는 추출됐지만 검증 기간의 가격 데이터를 안정적으로 연결하지 못한 리포트입니다.
            </Reason>
            <Reason label="매도 의견" value={`${sellOpinionRows.toLocaleString('ko-KR')}건`}>
              상승 목표가 검증과 방향이 다르므로 같은 통계 분모에 섞지 않습니다.
            </Reason>
            <Reason label="비실행" value={`${nonExecutableRows.toLocaleString('ko-KR')}건`}>
              목표 업사이드가 없거나 첫 거래 가능 가격이 목표가를 이미 넘어서, 실제 매수 검증으로 쓰기 어려운
              사례입니다.
            </Reason>
          </dl>
        </div>
      </Section>
    </div>
  );
}

function InsightBlock({ title, value, body }: { title: string; value: string; body: string }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs font-medium text-slate-500">{title}</div>
      <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-slate-950">{value}</div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
    </article>
  );
}

function Formula({ title, formula, children }: { title: string; formula: string; children: React.ReactNode }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-base font-semibold tracking-tight text-slate-950">{title}</h3>
      <code className="mt-2 block rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700">{formula}</code>
      <p className="mt-3 text-sm leading-6 text-slate-600">{children}</p>
    </article>
  );
}

function Reason({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2 p-4 md:grid-cols-[10rem_8rem_1fr] md:items-start">
      <dt className="font-semibold text-slate-950">{label}</dt>
      <dd className="font-mono font-semibold tabular-nums text-slate-700">{value}</dd>
      <dd className="text-sm leading-6 text-slate-600">{children}</dd>
    </div>
  );
}
