import Link from 'next/link';
import { MetricCard, Panel, StatusPill } from '@/components/ui/Terminal';
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
};

export function StrategySummary({ run, href }: { run: StrategyRun; href?: string }) {
  const params = run.params ?? {};
  const topParams = Object.keys(params).slice(0, 6);

  return (
    <Panel>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="badge badge-ghost badge-sm mb-2">{run.scope ?? 'local'} · {run.sampler ?? 'artifact'}{run.trial_number !== undefined ? ` · trial ${run.trial_number}` : ''}</p>
          <h2 className="text-2xl font-black tracking-[-0.04em]">{href ? <Link className="link link-hover" href={href}>{run.label}</Link> : run.label}</h2>
        </div>
        <StatusPill tone="accent">score {formatPercent(run.metrics.score)}</StatusPill>
      </div>
      <dl className="mt-4 grid gap-3 md:grid-cols-4">
        <MetricCard label="최종 자산" value={formatKrw(run.metrics.final_equity_krw)} tone="good" />
        <MetricCard label="IRR proxy" value={formatPercent(run.metrics.money_weighted_return)} />
        <MetricCard label="MDD" value={formatPercent(run.metrics.max_drawdown)} tone="bad" />
        <MetricCard label="목표 도달률" value={formatPercent(run.metrics.hit_rate)} tone="accent" />
      </dl>
      {topParams.length ? (
        <div className="mt-4 flex flex-wrap gap-2" aria-label="핵심 파라미터">
          {topParams.map((key) => <span className="badge badge-outline" key={key}>{PARAM_LABELS[key] ?? key}: {formatParam(params[key])}</span>)}
        </div>
      ) : null}
      {href ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Link className="btn btn-sm btn-primary" href={href}>실험 포트폴리오·매매내역 보기</Link>
        </div>
      ) : null}
      {run.warnings?.length ? (
        <div className="mt-4 grid gap-2">
          {run.warnings.map((warning) => <div className="alert alert-warning alert-soft py-2 text-sm" key={warning}>주의: {warning}</div>)}
        </div>
      ) : null}
    </Panel>
  );
}

function formatParam(value: unknown): string {
  if (typeof value === 'number') {
    if (Math.abs(value) < 1) return formatPercent(roundTwo(value));
    return roundTwo(value).toLocaleString('ko-KR', { maximumFractionDigits: 2, minimumFractionDigits: Number.isInteger(roundTwo(value)) ? 0 : 2 });
  }
  if (typeof value === 'boolean') return value ? '예' : '아니오';
  return String(value ?? '—');
}

function roundTwo(value: number): number {
  return Math.round(value * 100) / 100;
}
