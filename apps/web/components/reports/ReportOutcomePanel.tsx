import Link from 'next/link';
import type { ReportRow, ReportStatisticsLabSummary } from '@/lib/artifacts';
import { formatDays, formatPercent } from '@/lib/format';
import { reportEntryPrice } from '@/lib/report-view-model';

type OutcomeRow = ReportStatisticsLabSummary['riskScatter'][number];

type Props = {
  report: ReportRow;
  outcome: OutcomeRow | null;
};

export function ReportOutcomePanel({ report, outcome }: Props) {
  const entryPrice = reportEntryPrice(report);
  const targetReturn = outcome?.targetReturn ?? report.targetUpsideAtPub;
  const currentReturn = outcome?.currentReturn ?? report.currentReturn;
  const peakReturn = outcome?.maxFavorableExcursion ?? report.peakReturn;
  const troughReturn = outcome?.maxAdverseExcursion ?? report.troughReturn;
  const captureRatio = outcome?.upsideCaptureRatio ?? captureFromReport(report);
  const path = classifyPath(outcome, report);

  return (
    <section className="grid gap-5 border-b border-slate-200 pb-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="min-w-0">
        <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          리포트 결과
        </div>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-slate-950 md:text-3xl">
          발간 이후 가격이 어떤 길을 지나왔는지 먼저 봅니다
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
          이 화면은 목표가 적중 여부만 판정하지 않습니다. 발간가 대비 현재 수익률, 중간에 열렸던 최대 상승폭, 견뎌야
          했던 최대 하락폭, 목표가 대비 실제 도달 정도를 같이 놓고 봅니다. 같은 “목표 도달”도 경로가 다르면 개인투자자가
          감수한 시간과 손실이 완전히 다르기 때문입니다.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            className="inline-flex h-8 items-center rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
            href="/reports/statistics"
          >
            전체 통계 보기
          </Link>
          <Link
            className="inline-flex h-8 items-center rounded-md px-3 text-xs font-medium text-slate-600 hover:bg-slate-100"
            href="/reports"
          >
            리포트 표로 돌아가기
          </Link>
        </div>
      </div>

      <div className="min-w-0 rounded-2xl border border-slate-200 bg-white">
        <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
          <div>
            <div className="text-xs font-medium text-slate-500">경로 분류</div>
            <div className={`mt-1 text-lg font-semibold tracking-tight ${path.toneClass}`}>{path.label}</div>
            <p className="mt-1 text-xs leading-5 text-slate-500">{path.detail}</p>
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-1 font-mono text-[11px] text-slate-500">
            {report.publicationDate} 발간
          </div>
        </div>

        <dl className="divide-y divide-slate-100">
          <OutcomeLine
            label="발간 시 목표 수익률"
            value={formatPercent(targetReturn)}
            caption={entryPrice ? '발간가 대비 목표가' : '발간가 없음'}
          />
          <OutcomeLine
            label="현재 수익률"
            value={formatPercent(currentReturn)}
            tone={toneForSigned(currentReturn)}
            caption={report.lastCloseDate ?? '최근 가격일 없음'}
          />
          <OutcomeLine
            label="최대 상승폭"
            value={formatPercent(peakReturn)}
            tone="good"
            caption="발간 이후 관측 고점 기준"
          />
          <OutcomeLine
            label="최대 하락폭"
            value={formatPercent(troughReturn)}
            tone="bad"
            caption="발간 이후 관측 저점 기준"
          />
          <OutcomeLine
            label="목표 대비 최고 도달"
            value={formatCapture(captureRatio)}
            caption="최대 상승폭 ÷ 목표 수익률"
          />
          <OutcomeLine
            label="목표 도달 단계"
            value={targetStage(outcome, report)}
            caption={targetStageCaption(outcome, report)}
          />
        </dl>
      </div>
    </section>
  );
}

function OutcomeLine({
  label,
  value,
  caption,
  tone,
}: {
  label: string;
  value: string;
  caption: string;
  tone?: 'good' | 'bad' | 'neutral';
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-4 py-3">
      <div className="min-w-0">
        <dt className="text-sm font-medium text-slate-800">{label}</dt>
        <dd className="mt-0.5 text-xs leading-5 text-slate-500">{caption}</dd>
      </div>
      <dd className={`font-mono text-base font-semibold tabular-nums ${toneClass(tone)}`}>{value}</dd>
    </div>
  );
}

function classifyPath(outcome: OutcomeRow | null, report: ReportRow) {
  const currentReturn = outcome?.currentReturn ?? report.currentReturn ?? 0;
  const favorable = outcome?.maxFavorableExcursion ?? report.peakReturn ?? 0;
  const adverse = outcome?.maxAdverseExcursion ?? report.troughReturn ?? 0;
  const hit08 = outcome?.hit08 ?? report.targetHit;
  const hit10 = outcome?.hit10 ?? report.targetHit;

  if (hit08 && currentReturn >= 0.2 && adverse >= -0.1) {
    return {
      label: '상승이 유지된 적중 사례',
      detail: '목표권에 닿았고 현재 수익도 남아 있습니다. 다만 이 한 건을 매수 신호로 보지는 않습니다.',
      toneClass: 'text-blue-600',
    };
  }
  if (hit08 && adverse <= -0.2) {
    return {
      label: '맞았지만 경로가 거칠었습니다',
      detail: '목표권에 닿기 전후로 큰 중간 손실이 있었습니다. 손절 규칙을 검정할 때 먼저 봐야 할 유형입니다.',
      toneClass: 'text-amber-600',
    };
  }
  if (favorable >= 0.5 && currentReturn < 0.1) {
    return {
      label: '한때 크게 올랐지만 많이 반납했습니다',
      detail: '목표가를 출구로 삼을지, 보유 기준을 따로 둘지 검정해야 하는 유형입니다.',
      toneClass: 'text-slate-700',
    };
  }
  if (currentReturn <= -0.2 && favorable < 0.2) {
    return {
      label: '손실 꼬리에 들어간 사례',
      detail: '평균 수익률 안에 숨기면 안 되는 실패 표본입니다. 제외 조건과 시간 손절 후보입니다.',
      toneClass: 'text-rose-600',
    };
  }
  if (hit10) {
    return {
      label: '목표가에는 도달했습니다',
      detail: '목표 도달 이후의 유지 여부와 중간 손실을 함께 확인해야 합니다.',
      toneClass: 'text-blue-600',
    };
  }
  return {
    label: '아직 결론을 단순화하기 어렵습니다',
    detail: '현재 수익률, 목표 진행률, 가격 경로를 함께 놓고 후속 규칙 후보로만 봅니다.',
    toneClass: 'text-slate-700',
  };
}

function captureFromReport(report: ReportRow): number | null {
  const peak = report.peakReturn;
  const target = report.targetUpsideAtPub;
  if (peak === null || target === null || !Number.isFinite(peak) || !Number.isFinite(target) || target === 0)
    return null;
  return peak / target;
}

function formatCapture(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${value.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}x`;
}

function targetStage(outcome: OutcomeRow | null, report: ReportRow): string {
  if (outcome?.hit10 || report.targetHit) return '1.0x';
  if (outcome?.hit08) return '0.8x';
  if (outcome?.hit06) return '0.6x';
  return '미도달';
}

function targetStageCaption(outcome: OutcomeRow | null, report: ReportRow): string {
  if (report.targetHit) return `${report.targetHitDate ?? '도달일 없음'} · ${formatDays(report.daysToTarget)}`;
  if (outcome?.hit08) return '원 목표가의 80% 구간까지 도달한 표본입니다.';
  if (outcome?.hit06) return '원 목표가의 60% 구간까지 도달한 표본입니다.';
  return '가격 경로 기준 목표권에 닿지 않았습니다.';
}

function toneForSigned(value: number | null | undefined): 'good' | 'bad' | 'neutral' {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'neutral';
  return value >= 0 ? 'good' : 'bad';
}

function toneClass(tone?: 'good' | 'bad' | 'neutral') {
  if (tone === 'good') return 'text-blue-600';
  if (tone === 'bad') return 'text-rose-600';
  return 'text-slate-950';
}
