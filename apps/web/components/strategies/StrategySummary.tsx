import Link from 'next/link';
import { formatKrw, formatPercent } from '@/lib/format';

type StrategyRun = {
  run_id: string;
  trial_number?: number;
  label: string;
  scope?: string;
  sampler?: string;
  params?: Record<string, unknown>;
  metrics: Record<string, number | null | undefined>;
  warnings?: string[];
};

const PARAM_LABELS: Record<string, string> = {
  max_positions: '최대 보유',
  stop_loss_pct: '손절',
  take_profit_pct: '익절',
  min_target_upside_at_pub: '최소 업사이드',
  max_target_upside_at_pub: '최대 업사이드',
  target_hit_multiplier: '목표가 배율',
  max_report_age_days: '최대 리포트 나이',
  time_loss_days: '시간 손절',
  rebalance: '리밸런싱',
  weighting: '비중 기준',
  universe: '유니버스',
  require_mtt: 'MTT',
  min_price_vs_52w_low: '52주 저점 대비',
  max_pct_below_52w_high: '52주 고점 이격',
  min_ma200_1m_return: '200일선 1M 추세',
};

export function StrategySummary({ run, href }: { run: StrategyRun; href?: string }) {
  const params = run.params ?? {};
  const topParams = Object.keys(params).slice(0, 5);
  const verdict = strategyVerdict(run);
  const finalEquity = run.metrics.final_equity_krw ?? null;
  const mwr = run.metrics.money_weighted_return ?? null;
  const mdd = run.metrics.max_drawdown ?? null;
  const hitRate = run.metrics.hit_rate ?? null;
  const trainMwr = run.metrics.train_money_weighted_return ?? null;
  const fullMwr = run.metrics.full_money_weighted_return ?? run.metrics.money_weighted_return ?? null;
  const holdoutMwr = run.metrics.holdout_money_weighted_return ?? null;
  const tradeCount = run.metrics.trade_count ?? null;
  const openPositions = run.metrics.open_positions ?? null;

  return (
    <article className="lab-panel transition hover:border-primary/40">
      <div className="grid gap-4 p-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="text-xs font-mono uppercase tracking-[0.16em] text-base-content/55">
              {run.scope ?? 'local'} · {run.sampler ?? 'artifact'}
              {run.trial_number !== undefined ? ` · trial ${run.trial_number}` : ''}
            </span>
            <h3 className="mt-1 text-xl font-black tracking-[-0.03em] md:text-2xl">
              {href ? (
                <Link className="link link-hover" href={href}>
                  {run.label}
                </Link>
              ) : (
                run.label
              )}
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`badge badge-soft ${verdict.tone === 'good' ? 'badge-success' : verdict.tone === 'warn' ? 'badge-warning' : 'badge-ghost'}`}
            >
              {verdict.label}
            </span>
            {(mdd ?? 0) > 0.25 ? <span className="badge badge-warning badge-soft">낙폭 점검 필요</span> : null}
            <span className="badge badge-primary badge-soft">score {formatPercent(run.metrics.score)}</span>
          </div>
        </header>

        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 2xl:grid-cols-5">
          <Stat
            label="최종 자산"
            value={finalEquity !== null ? formatKrw(finalEquity) : '—'}
            tone={(finalEquity ?? 0) > 0 ? 'good' : 'neutral'}
          />
          <Stat label="MWR" value={formatPercent(mwr)} tone={(mwr ?? 0) >= 0 ? 'good' : 'bad'} />
          <Stat label="MDD" value={formatPercent(mdd)} tone={(mdd ?? 0) > 0.25 ? 'bad' : 'warn'} />
          <Stat label="거래" value={tradeCount !== null ? Number(tradeCount).toLocaleString('ko-KR') : '—'} />
          <Stat label="보유" value={openPositions !== null ? Number(openPositions).toLocaleString('ko-KR') : '—'} />
        </dl>

        {trainMwr !== null || holdoutMwr !== null ? (
          <div className="grid gap-2 rounded-md border border-base-200 bg-base-200/35 p-3 text-sm text-base-content/70 md:grid-cols-3">
            <span>
              Train MWR <strong className="text-base-content tabular-nums">{formatPercent(trainMwr)}</strong>
            </span>
            <span>
              Full MWR <strong className="text-base-content tabular-nums">{formatPercent(fullMwr)}</strong>
            </span>
            <span>
              Holdout MWR <strong className="text-base-content tabular-nums">{formatPercent(holdoutMwr)}</strong>
            </span>
          </div>
        ) : null}

        {hitRate !== null ? (
          <div className="text-sm text-base-content/65">
            목표 도달률 <strong className="text-base-content tabular-nums">{formatPercent(hitRate)}</strong>
          </div>
        ) : null}

        {topParams.length ? (
          <div className="flex flex-wrap gap-1.5" aria-label="핵심 파라미터">
            {topParams.map((key) => (
              <span className="badge badge-outline badge-sm" key={key}>
                {PARAM_LABELS[key] ?? key}: {formatParam(params[key])}
              </span>
            ))}
          </div>
        ) : null}

        {run.warnings?.length ? (
          <ul className="grid gap-1 text-xs text-warning">
            {run.warnings.map((warning) => (
              <li key={warning}>주의: {warning}</li>
            ))}
          </ul>
        ) : null}

        {href ? (
          <div className="card-actions">
            <Link className="btn btn-sm btn-primary" href={href}>
              재구성 이벤트
            </Link>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function Stat({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'good' | 'bad' | 'warn' | 'neutral';
}) {
  const toneClass =
    tone === 'good'
      ? 'text-success'
      : tone === 'bad'
        ? 'text-error'
        : tone === 'warn'
          ? 'text-warning'
          : 'text-base-content';
  return (
    <div className="min-w-0 rounded-md border border-base-200 bg-base-100 px-3 py-2.5">
      <dt className="text-xs uppercase tracking-[0.14em] text-base-content/55">{label}</dt>
      <dd className={`mt-1 break-words text-sm font-bold tabular-nums sm:text-base ${toneClass}`}>{value}</dd>
    </div>
  );
}

function strategyVerdict(run: StrategyRun): { label: string; tone: 'good' | 'warn' | 'neutral' } {
  const mdd = run.metrics.max_drawdown ?? null;
  const mwr = run.metrics.money_weighted_return ?? null;
  if (run.warnings?.length) return { label: '주의', tone: 'warn' };
  if (mwr === null || mdd === null) return { label: '검토 필요', tone: 'neutral' };
  if (mwr > 0 && mdd < 0.2) return { label: '강한 후보', tone: 'good' };
  if (mdd > 0.25) return { label: '낙폭 큼', tone: 'warn' };
  return { label: '검토 필요', tone: 'neutral' };
}

function formatParam(value: unknown): string {
  if (typeof value === 'number') {
    if (Math.abs(value) < 1) return formatPercent(roundTwo(value));
    return roundTwo(value).toLocaleString('ko-KR', {
      maximumFractionDigits: 2,
      minimumFractionDigits: Number.isInteger(roundTwo(value)) ? 0 : 2,
    });
  }
  if (typeof value === 'boolean') return value ? '예' : '아니오';
  return String(value ?? '—');
}

function roundTwo(value: number): number {
  return Math.round(value * 100) / 100;
}
