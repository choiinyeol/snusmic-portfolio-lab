import Link from 'next/link';
import { KpiTile } from '@/components/ui/KpiTile';
import { Money } from '@/components/ui/Money';
import { PageHero } from '@/components/ui/PageHero';
import { Section } from '@/components/ui/Section';
import { getResearchCandidates, buildReportStats, type ResearchCandidate } from '@/lib/product-model';
import { formatDateKo, formatDays, formatPercent, signedTextClass } from '@/lib/format';

const BUCKET_LABEL: Record<ResearchCandidate['bucket'], string> = {
  fresh: '최근 리포트',
  'large-upside': '큰 업사이드',
  'near-target': '목표 근접',
  active: '활성 후보',
};

export default function ScreenerPage() {
  const candidates = getResearchCandidates();
  const stats = buildReportStats();
  const buckets = groupCandidates(candidates);

  return (
    <>
      <PageHero
        eyebrow="Research Queue"
        title="후보 탐색"
        subtitle="최근성, 목표가 진행률, 남은 업사이드를 기준으로 다시 확인할 리포트 후보를 정렬합니다."
        badges={[
          { label: '후보', value: `${candidates.length}개` },
          { label: '활성 리포트', value: `${stats.activeCount}개` },
          { label: '정렬 기준', value: '공개 지표' },
          { label: '데이터', value: '정적 스냅샷' },
        ]}
        kpis={
          <div className="grid min-w-0 gap-3 min-[1400px]:grid-cols-2">
            <KpiTile
              label="목표가 적중률"
              value={formatPercent(stats.targetHitRate)}
              delta={`${stats.hitCount}/${stats.total}`}
              tone="good"
            />
            <KpiTile
              label="평균 목표 진행"
              value={formatPercent(stats.averageTargetProgress)}
              delta="진행 중 포함"
              tone="accent"
            />
            <KpiTile
              label="현재 플러스"
              value={formatPercent(stats.positiveReturnRate)}
              delta={`${stats.positiveReturnCount}개 리포트`}
            />
            <KpiTile label="최신 발간" value={formatDateKo(stats.latestPublicationDate)} delta="읽기 전용 기준" />
          </div>
        }
      />

      <Section
        eyebrow="Queue Rules"
        title="추천이 아니라 설명 가능한 리포트 후보"
        caption="정렬 기준은 최근성, 목표 업사이드, 목표 진행률, 미도달/미만료 상태입니다. 주문 추천이 아니라 다시 확인할 후보를 보여줍니다."
      >
        <div className="grid gap-3 lg:grid-cols-4">
          {Object.entries(buckets).map(([bucket, rows]) => (
            <a key={bucket} className="lab-panel p-4" href={`#${bucket}`}>
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-base-content/45">{bucket}</div>
              <div className="mt-2 text-xl font-black tracking-[-0.04em]">
                {BUCKET_LABEL[bucket as ResearchCandidate['bucket']]}
              </div>
              <div className="mt-1 text-sm text-base-content/55">{rows.length.toLocaleString('ko-KR')}개 후보</div>
            </a>
          ))}
        </div>
      </Section>

      <Section eyebrow="Research Queue" title="전체 후보">
        <div className="grid gap-3">
          {candidates.map((candidate, index) => (
            <CandidateCard key={candidate.report.reportId} candidate={candidate} rank={index + 1} />
          ))}
        </div>
      </Section>

      {Object.entries(buckets).map(([bucket, rows]) => (
        <Section key={bucket} id={bucket} eyebrow="Bucket" title={BUCKET_LABEL[bucket as ResearchCandidate['bucket']]}>
          <div className="grid gap-3 lg:grid-cols-2">
            {rows.slice(0, 8).map((candidate, index) => (
              <CandidateCard
                key={`${bucket}-${candidate.report.reportId}`}
                candidate={candidate}
                rank={index + 1}
                compact
              />
            ))}
          </div>
        </Section>
      ))}
    </>
  );
}

function CandidateCard({
  candidate,
  rank,
  compact = false,
}: {
  candidate: ResearchCandidate;
  rank: number;
  compact?: boolean;
}) {
  const report = candidate.report;
  return (
    <Link href={`/reports/${report.symbol}`} className="lab-panel p-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(420px,.9fr)] xl:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge badge-primary badge-soft badge-sm">#{rank}</span>
            <span className="badge badge-ghost badge-sm">{BUCKET_LABEL[candidate.bucket]}</span>
            <span className="badge badge-outline badge-sm font-mono">{report.symbol}</span>
          </div>
          <h2 className="mt-2 truncate text-lg font-black tracking-[-0.035em]">{report.company || report.symbol}</h2>
          {!compact ? <p className="mt-1 line-clamp-2 text-sm text-base-content/60">{report.title}</p> : null}
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-base-content/55">
            <span>{formatDateKo(report.publicationDate)}</span>
            <span>·</span>
            <span>{candidate.rankBasis}</span>
            <span>·</span>
            <span>목표 도달 예상 {formatDays(report.daysToTarget)}</span>
          </div>
        </div>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          <Metric
            label="현재 수익률"
            value={formatPercent(report.currentReturn)}
            tone={signedTextClass(report.currentReturn)}
          />
          <Metric label="발간 업사이드" value={formatPercent(report.targetUpsideAtPub)} />
          <Metric label="목표 진행률" value={formatPercent(report.targetProgressPct)} />
          <div className="min-w-0 rounded-xl bg-base-200/60 p-3">
            <div className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-base-content/45">현재가</div>
            <div className="mt-1 text-sm">
              <Money native={report.lastCloseNative} krw={report.lastCloseKrw} currency={report.currency} bold />
            </div>
          </div>
          <div className="min-w-0 rounded-xl bg-base-200/60 p-3">
            <div className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-base-content/45">목표가</div>
            <div className="mt-1 text-sm">
              <Money native={report.targetPriceNative} krw={report.targetPriceKrw} currency={report.currency} bold />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function Metric({ label, value, tone = 'text-base-content' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-base-200/60 p-3">
      <div className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-base-content/45">{label}</div>
      <div className={`mt-1 break-words font-mono text-sm font-black tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}

function groupCandidates(candidates: ResearchCandidate[]): Record<ResearchCandidate['bucket'], ResearchCandidate[]> {
  return {
    fresh: candidates.filter((row) => row.bucket === 'fresh'),
    'large-upside': candidates.filter((row) => row.bucket === 'large-upside'),
    'near-target': candidates.filter((row) => row.bucket === 'near-target'),
    active: candidates.filter((row) => row.bucket === 'active'),
  };
}
