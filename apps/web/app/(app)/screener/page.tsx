import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Money } from '@/components/ui/Money';
import { buildReportStats, getResearchCandidates, type ResearchCandidate } from '@/lib/product-model';
import { formatDateKo, formatDays, formatPercent, signedTextClass } from '@/lib/format';

const BUCKET_LABEL: Record<ResearchCandidate['bucket'], string> = {
  fresh: '최근 발간',
  'large-upside': '업사이드 큼',
  'near-target': '목표 근접',
  active: '활성 표본',
};

export default function ScreenerPage() {
  const candidates = getResearchCandidates();
  const stats = buildReportStats();
  const buckets = groupCandidates(candidates);
  const summary = [
    ['후보', `${candidates.length.toLocaleString('ko-KR')}개`, '중복 bucket은 필터로만 표시'],
    ['목표가 도달률', formatPercent(stats.targetHitRate), `${stats.hitCount}/${stats.total}건`],
    ['평균 목표 진행', formatPercent(stats.averageTargetProgress), '진행 중 포함'],
    ['현재 플러스', formatPercent(stats.positiveReturnRate), `${stats.positiveReturnCount}개 리포트`],
    ['최신 발간', formatDateKo(stats.latestPublicationDate), '저장 데이터 기준'],
  ];

  return (
    <div className="grid gap-6">
      <header className="border-b border-slate-200 pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-4xl">
            <Badge variant="outline">리포트 검토 대기열</Badge>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.045em] text-slate-950 md:text-4xl">후보 탐색</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              후보는 추천이나 주문 신호가 아닙니다. 최근성, 목표 잔여, 현재 수익률, 목표 진행률로 “다시 확인할 리포트”를
              한 줄 목록으로 정렬합니다.
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href="/reports">전체 리포트 표</Link>
          </Button>
        </div>
      </header>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white" aria-label="후보 요약">
        <div className="grid divide-y divide-slate-100 md:grid-cols-5 md:divide-x md:divide-y-0">
          {summary.map(([label, value, caption]) => (
            <div className="min-w-0 p-4" key={label}>
              <div className="text-xs font-medium text-slate-500">{label}</div>
              <div className="mt-2 truncate font-mono text-lg font-semibold tabular-nums text-slate-950">{value}</div>
              <div className="mt-1 truncate text-xs text-slate-500">{caption}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-wrap gap-2" aria-label="후보 bucket">
        {Object.entries(buckets).map(([bucket, rows]) => (
          <span className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700" key={bucket}>
            {BUCKET_LABEL[bucket as ResearchCandidate['bucket']]} · {rows.length.toLocaleString('ko-KR')}
          </span>
        ))}
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white" aria-label="전체 후보 목록">
        <div className="grid grid-cols-[7rem_minmax(220px,1fr)_7rem_7rem_7rem_8rem_7rem] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-500 max-lg:hidden">
          <div>분류</div>
          <div>리포트</div>
          <div className="text-right">현재 수익률</div>
          <div className="text-right">업사이드</div>
          <div className="text-right">진행률</div>
          <div className="text-right">현재가/목표가</div>
          <div className="text-right">발간</div>
        </div>
        <div className="divide-y divide-slate-100">
          {candidates.map((candidate) => (
            <CandidateRow key={candidate.report.reportId} candidate={candidate} />
          ))}
        </div>
      </section>
    </div>
  );
}

function CandidateRow({ candidate }: { candidate: ResearchCandidate }) {
  const report = candidate.report;
  return (
    <Link
      href={`/reports/${encodeURIComponent(report.symbol)}`}
      className="grid gap-3 px-4 py-3 transition-colors hover:bg-slate-50 lg:grid-cols-[7rem_minmax(220px,1fr)_7rem_7rem_7rem_8rem_7rem] lg:items-center"
    >
      <div>
        <Badge variant="secondary">{BUCKET_LABEL[candidate.bucket]}</Badge>
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-semibold text-slate-500">{report.symbol}</span>
          <h2 className="truncate text-sm font-semibold text-slate-950">{report.company || report.symbol}</h2>
        </div>
        <p className="mt-1 line-clamp-1 text-xs text-slate-500">{candidate.rankBasis}</p>
      </div>
      <Metric value={formatPercent(report.currentReturn)} tone={signedTextClass(report.currentReturn)} />
      <Metric value={formatPercent(report.targetUpsideAtPub)} />
      <Metric value={formatPercent(report.targetProgressPct)} />
      <div className="grid gap-1 text-right text-xs text-slate-500 max-lg:text-left">
        <Money native={report.lastCloseNative} krw={report.lastCloseKrw} currency={report.currency} bold />
        <span>목표 {formatPercent(report.targetRemainingPct)} 남음</span>
      </div>
      <div className="text-right font-mono text-xs text-slate-500 max-lg:text-left">
        {formatDateKo(report.publicationDate)}
        <br />
        {formatDays(report.daysToTarget)}
      </div>
    </Link>
  );
}

function Metric({ value, tone = 'text-slate-950' }: { value: string; tone?: string }) {
  return <div className={`font-mono text-sm font-semibold tabular-nums lg:text-right ${tone}`}>{value}</div>;
}

function groupCandidates(candidates: ResearchCandidate[]): Record<ResearchCandidate['bucket'], ResearchCandidate[]> {
  return {
    fresh: candidates.filter((row) => row.bucket === 'fresh'),
    'large-upside': candidates.filter((row) => row.bucket === 'large-upside'),
    'near-target': candidates.filter((row) => row.bucket === 'near-target'),
    active: candidates.filter((row) => row.bucket === 'active'),
  };
}
