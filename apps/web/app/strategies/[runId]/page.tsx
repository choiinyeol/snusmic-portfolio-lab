import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CumulativeReturnChart } from '@/components/charts/CumulativeReturnChart';
import { StrategySummary } from '@/components/strategies/StrategySummary';
import { KpiTile } from '@/components/ui/KpiTile';
import { PageHero } from '@/components/ui/PageHero';
import { Section } from '@/components/ui/Section';
import { getStrategyExperiment, getStrategyRuns } from '@/lib/artifacts';
import { formatKrw, formatPercent } from '@/lib/format';

type StrategyParams = Promise<{ runId: string }>;

export function generateStaticParams() {
  return getStrategyRuns().runs.map((run) => ({ runId: run.run_id }));
}

export default async function StrategyDetailPage({ params }: { params: StrategyParams }) {
  const { runId } = await params;
  const data = getStrategyRuns();
  const run = data.runs.find((item) => item.run_id === runId);
  if (!run) notFound();
  const experiment = getStrategyExperiment(run);
  const finalReturn = experiment.cumulativeReturnSeries.at(-1)?.value ?? run.metrics.money_weighted_return ?? null;

  return (
    <>
      <PageHero
        eyebrow="STRATEGY"
        title={run.label}
        subtitle="0.01 단위 이산 파라미터로 실험한 로컬 후보입니다."
        actions={
          <Link className="btn btn-sm btn-ghost" href="/strategies">
            ← 전략 기준
          </Link>
        }
        kpis={
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <KpiTile
              label="실험 선택 종목"
              value={experiment.positions.length.toLocaleString('ko-KR')}
              delta={`${experiment.trades.length.toLocaleString('ko-KR')}개 이벤트`}
              tone="accent"
            />
            <KpiTile
              label="실험 누적 수익률"
              value={formatPercent(finalReturn)}
              tone={(finalReturn ?? 0) >= 0 ? 'good' : 'bad'}
            />
          </div>
        }
      />

      <StrategySummary run={run} />

      <Section eyebrow="Curve" title="누적 수익률 경로">
        <article className="card border border-base-300 bg-base-100 shadow-sm">
          <div className="card-body p-3 md:p-4">
            <CumulativeReturnChart
              series={[
                { id: run.run_id, label: run.label, color: '#d7ff4f', points: experiment.cumulativeReturnSeries },
              ]}
            />
          </div>
        </article>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section eyebrow="Positions" title="실험 포트폴리오">
          <article className="card border border-base-300 bg-base-100 shadow-sm">
            <div className="overflow-x-auto">
              <table className="table table-sm table-zebra">
                <thead>
                  <tr>
                    <th>종목</th>
                    <th>발간일</th>
                    <th>비중</th>
                    <th>진입가</th>
                    <th>목표가</th>
                    <th>실험 수익률</th>
                    <th>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {experiment.positions.map((position) => (
                    <tr key={`${position.symbol}-${position.publicationDate}`}>
                      <td>
                        <Link className="link link-hover" href={`/reports/${position.symbol}`}>
                          {position.company || position.symbol}
                        </Link>
                        <div className="text-xs text-base-content/55">{position.symbol}</div>
                      </td>
                      <td className="font-mono text-xs">{position.publicationDate}</td>
                      <td className="tabular-nums">{formatPercent(position.weight)}</td>
                      <td className="tabular-nums">{formatKrw(position.entryPriceKrw)}</td>
                      <td className="tabular-nums">{formatKrw(position.targetPriceKrw)}</td>
                      <td
                        className={`tabular-nums ${(position.realizedReturn ?? 0) >= 0 ? 'text-success' : 'text-error'}`}
                      >
                        {formatPercent(position.realizedReturn)}
                      </td>
                      <td>{position.status === 'closed' ? `청산 · ${position.exitDate}` : '보유/오픈'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </Section>

        <Section eyebrow="Trades" title="실험 매매내역">
          <article className="card border border-base-300 bg-base-100 shadow-sm">
            <div className="overflow-x-auto">
              <table className="table table-sm table-zebra">
                <thead>
                  <tr>
                    <th>일자</th>
                    <th>구분</th>
                    <th>종목</th>
                    <th>비중</th>
                    <th>참조가격</th>
                    <th>기준</th>
                  </tr>
                </thead>
                <tbody>
                  {experiment.trades.map((trade) => (
                    <tr key={`${trade.date}-${trade.side}-${trade.symbol}`}>
                      <td className="font-mono text-xs">{trade.date}</td>
                      <td>
                        <span
                          className={`badge badge-soft badge-sm ${trade.side === 'buy' ? 'badge-success' : 'badge-warning'}`}
                        >
                          {trade.side === 'buy' ? '매수' : '매도'}
                        </span>
                      </td>
                      <td>
                        <Link className="link link-hover" href={`/reports/${trade.symbol}`}>
                          {trade.company || trade.symbol}
                        </Link>
                        <div className="text-xs text-base-content/55">{trade.symbol}</div>
                      </td>
                      <td className="tabular-nums">{formatPercent(trade.weight)}</td>
                      <td className="tabular-nums">{formatKrw(trade.referencePriceKrw)}</td>
                      <td className="text-sm">{trade.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </Section>
      </div>

      <Section eyebrow="Params" title="파라미터">
        <article className="card border border-base-300 bg-base-100 shadow-sm">
          <div className="card-body grid gap-3 p-5 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(run.params ?? {}).map(([key, value]) => (
              <div className="rounded-md border border-base-200 bg-base-100 px-3 py-2.5" key={key}>
                <dt className="text-xs font-mono uppercase tracking-[0.14em] text-base-content/55">{key}</dt>
                <dd className="mt-1 font-bold tabular-nums text-base-content">{formatParam(value)}</dd>
              </div>
            ))}
          </div>
        </article>
      </Section>
    </>
  );
}

function formatParam(value: unknown): string {
  if (typeof value === 'number')
    return Math.round(value * 100) / 100 === Math.round(value)
      ? Math.round(value).toLocaleString('ko-KR')
      : (Math.round(value * 100) / 100).toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (typeof value === 'boolean') return value ? '예' : '아니오';
  return String(value ?? '—');
}
