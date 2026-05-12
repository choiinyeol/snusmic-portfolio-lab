'use client';

import Link from 'next/link';
import { useMemo, useState, type ReactNode } from 'react';
import type { PositionEpisodeRow, TradeRow } from '@/lib/artifacts';
import { formatDays, formatKrw, formatPercent } from '@/lib/format';
import { DEFAULT_PERSONA } from '@/components/trading/TableControls';
import { DataTable } from '@/components/ui/DataTable';
import { Money } from '@/components/ui/Money';
import { SegmentedControl } from '@/components/ui/SegmentedControl';

type Props = {
  symbol: string;
  episodes: PositionEpisodeRow[];
  trades: TradeRow[];
  personaLabels: Record<string, string>;
};

export function SymbolPersonaTrades({ symbol, episodes, trades, personaLabels }: Props) {
  const personas = useMemo(() => {
    const ids = Array.from(new Set([...episodes.map((row) => row.persona), ...trades.map((row) => row.persona)]))
      .filter(Boolean)
      .sort();
    return ids.sort(
      (a, b) =>
        Number(b === DEFAULT_PERSONA) - Number(a === DEFAULT_PERSONA) ||
        (personaLabels[a] ?? a).localeCompare(personaLabels[b] ?? b, 'ko-KR'),
    );
  }, [episodes, personaLabels, trades]);
  const [persona, setPersona] = useState(() =>
    personas.includes(DEFAULT_PERSONA) ? DEFAULT_PERSONA : (personas[0] ?? ''),
  );
  const selectedEpisodes = useMemo(() => episodes.filter((row) => row.persona === persona), [episodes, persona]);
  const selectedTrades = useMemo(() => trades.filter((row) => row.persona === persona), [persona, trades]);
  const realizedPnl = selectedEpisodes.reduce((sum, row) => sum + (row.realizedPnlKrw ?? 0), 0);
  const unrealizedPnl = selectedEpisodes.reduce((sum, row) => sum + (row.unrealizedPnlKrw ?? 0), 0);
  const totalPnl = realizedPnl + unrealizedPnl;
  const openEpisodes = selectedEpisodes.filter((row) => row.status === 'open');
  const lastTrade = selectedTrades.at(0);
  const lastClosedEpisode = selectedEpisodes.find((row) => row.status === 'closed');
  const recentTrades = selectedTrades.slice(0, 5);
  const summaryAvgEntry = openEpisodes.length ? openEpisodes[0] : (selectedEpisodes[0] ?? null);

  if (!personas.length) {
    return (
      <section id="persona-trades" className="card min-w-0 border border-base-300 bg-base-100 shadow-sm">
        <div className="card-body gap-2 p-5">
          <h2 className="text-lg font-bold tracking-tight">페르소나별 매매 내역</h2>
          <p className="text-sm text-base-content/65">{symbol}에 연결된 전략 매매 내역이 없습니다.</p>
        </div>
      </section>
    );
  }

  return (
    <section id="persona-trades" className="grid min-w-0 gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">페르소나별 매매 내역</h2>
          <p className="mt-1 text-sm text-base-content/65">
            전략별로 {symbol}을 어떻게 진입·증액·축소했는지 한 화면에서 비교합니다.
          </p>
        </div>
        <Link className="btn btn-sm btn-ghost" href={`/portfolio?strategy=${persona}`}>
          포트폴리오 원장 →
        </Link>
      </div>
      <SegmentedControl
        ariaLabel="페르소나 선택"
        className="compact"
        value={persona}
        onChange={setPersona}
        options={personas.map((item) => ({ id: item, label: personaLabels[item] ?? item }))}
      />

      <article className="card min-w-0 border border-base-300 bg-base-100 shadow-sm">
        <div className="card-body min-w-0 gap-4 p-5">
          <header className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-base-content/55">현재 상태</span>
              <h3 className="mt-1 text-lg font-bold tracking-tight">{personaLabels[persona] ?? persona}</h3>
              <p className="mt-1 text-sm text-base-content/65">{strategyDescription(persona)}</p>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-xs uppercase tracking-[0.18em] text-base-content/55">총 손익</span>
              <strong className={`text-2xl font-black tabular-nums ${totalPnl >= 0 ? 'text-success' : 'text-error'}`}>
                {formatKrw(totalPnl)}
              </strong>
              <span className="text-xs text-base-content/55">
                실현 {formatKrw(realizedPnl)} · 미실현 {formatKrw(unrealizedPnl)}
              </span>
            </div>
          </header>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryStat
              label="보유 포지션"
              value={openEpisodes.length ? `${openEpisodes.length}개` : '없음'}
              caption={openEpisodes.length ? `진입 ${openEpisodes[0]?.openDate ?? '—'}` : null}
            />
            <SummaryStat
              label="진입 평균가"
              value={
                summaryAvgEntry?.avgEntryPriceKrw ? (
                  <Money
                    native={summaryAvgEntry.avgEntryPriceNative}
                    krw={summaryAvgEntry.avgEntryPriceKrw}
                    currency={summaryAvgEntry.currency}
                  />
                ) : (
                  '—'
                )
              }
              caption={
                summaryAvgEntry
                  ? `${summaryAvgEntry.totalQtyBought ?? 0}주 매입 · ${summaryAvgEntry.buyFills ?? 0}회 체결`
                  : null
              }
            />
            <SummaryStat
              label="누적 체결"
              value={`${selectedTrades.length}건`}
              caption={`매수 ${selectedTrades.filter((t) => t.side === 'buy').length} · 매도 ${selectedTrades.filter((t) => t.side === 'sell').length}`}
            />
            <SummaryStat
              label="마지막 매매"
              value={
                lastTrade
                  ? `${lastTrade.side === 'buy' ? '매수' : '매도'} ${lastTrade.qty?.toLocaleString('ko-KR') ?? '—'}주`
                  : '—'
              }
              caption={lastTrade ? `${lastTrade.date} · ${humanReason(lastTrade.reason)}` : null}
            />
          </dl>
          {lastClosedEpisode ? (
            <div className="rounded-lg border border-base-300 bg-base-200/40 px-4 py-3 text-sm text-base-content/75">
              <span className="font-semibold text-base-content">최근 청산 사유</span>
              <span className="ml-2">{humanReason(lastClosedEpisode.exitReasons)}</span>
              <span className="ml-2 text-base-content/55">
                · {lastClosedEpisode.closeDate ?? '—'} · {formatDays(lastClosedEpisode.holdingDays)} 보유
              </span>
            </div>
          ) : null}
        </div>
      </article>

      <article className="card min-w-0 border border-base-300 bg-base-100 shadow-sm">
        <div className="card-body min-w-0 gap-4 p-5">
          <header className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-base font-bold tracking-tight">포지션 생애주기</h3>
            <span className="text-xs text-base-content/55">
              {selectedEpisodes.length}개 포지션 · 최근 체결 {recentTrades.length}건
            </span>
          </header>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="grid gap-2.5" aria-label="포지션 카드">
              {selectedEpisodes.slice(0, 3).map((episode) => {
                const exitOrLast = episode.avgExitPriceKrw ?? episode.lastCloseKrw;
                const stockReturn =
                  episode.avgEntryPriceKrw && exitOrLast ? exitOrLast / episode.avgEntryPriceKrw - 1 : null;
                return (
                  <article
                    className="rounded-lg border border-base-300 bg-base-100 p-3"
                    key={`${episode.persona}-${episode.symbol}-${episode.openDate}`}
                  >
                    <div className="flex items-center justify-between text-xs uppercase tracking-[0.16em] text-base-content/55">
                      <strong className="text-base-content">
                        {episode.status === 'open' ? '보유 중' : '청산 완료'}
                      </strong>
                      <span>{formatDays(episode.holdingDays)}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-base-content/65">
                      <span>{episode.openDate}</span>
                      <span aria-hidden className="h-px flex-1 bg-base-300" />
                      <span>{episode.closeDate ?? '현재'}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-1.5 text-sm">
                      <div className="flex flex-col">
                        <em className="not-italic text-xs text-base-content/55">진입</em>
                        <Money
                          native={episode.avgEntryPriceNative}
                          krw={episode.avgEntryPriceKrw}
                          currency={episode.currency}
                        />
                      </div>
                      <div className="flex flex-col">
                        <em className="not-italic text-xs text-base-content/55">최근/청산</em>
                        <Money
                          native={episode.avgExitPriceNative ?? episode.lastCloseNative}
                          krw={exitOrLast}
                          currency={episode.currency}
                        />
                      </div>
                    </div>
                    <strong
                      className={`mt-2 block text-right tabular-nums ${(stockReturn ?? 0) >= 0 ? 'text-success' : 'text-error'}`}
                    >
                      {formatPercent(stockReturn)}
                    </strong>
                  </article>
                );
              })}
              {selectedEpisodes.length > 3 ? (
                <p className="text-xs text-base-content/55">
                  아래 표에서 전체 {selectedEpisodes.length}개 포지션을 확인할 수 있습니다.
                </p>
              ) : null}
            </div>
            <div className="grid gap-1.5" aria-label="최근 체결 활동">
              <div className="flex items-baseline justify-between text-xs">
                <strong className="text-base-content">최근 체결 흐름</strong>
                <span className="text-base-content/55">{recentTrades.length}건 표시</span>
              </div>
              {recentTrades.map((trade) => (
                <div
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-2.5 rounded-md border border-base-200 px-3 py-2 text-sm"
                  key={`event-${trade.persona}-${trade.date}-${trade.side}-${trade.qty}-${trade.fillPriceKrw}`}
                >
                  <span className={`h-2 w-2 rounded-full ${trade.side === 'buy' ? 'bg-success' : 'bg-error'}`} />
                  <div className="min-w-0">
                    <strong className="block truncate text-base-content">
                      {trade.side === 'buy' ? '매수' : '매도'} {trade.qty?.toLocaleString('ko-KR') ?? '—'}주
                    </strong>
                    <span className="block truncate text-xs text-base-content/55">
                      {trade.date} · {humanReason(trade.reason)}
                    </span>
                  </div>
                  <span className="tabular-nums">
                    <Money native={trade.fillPriceNative} krw={trade.fillPriceKrw} currency={trade.currency} />
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </article>

      <details className="card min-w-0 border border-base-300 bg-base-100 shadow-sm">
        <summary className="cursor-pointer list-none p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h3 className="text-base font-bold tracking-tight">전체 포지션 생애주기</h3>
            <span className="text-xs text-base-content/55">{selectedEpisodes.length}개 포지션 · 펼치기</span>
          </div>
        </summary>
        <div className="min-w-0 px-5 pb-5">
          <DataTable compact className="ledger-table-wrap">
            <thead>
              <tr>
                <th>매수 시작</th>
                <th>매도/상태</th>
                <th className="num">보유일</th>
                <th className="num">매수/매도</th>
                <th className="num">평균 진입</th>
                <th className="num">평균 청산/최근</th>
                <th className="num">종목 수익률</th>
                <th className="num">손익</th>
                <th>매도 기준</th>
              </tr>
            </thead>
            <tbody>
              {selectedEpisodes.map((episode) => {
                const exitOrLast = episode.avgExitPriceKrw ?? episode.lastCloseKrw;
                const stockReturn =
                  episode.avgEntryPriceKrw && exitOrLast ? exitOrLast / episode.avgEntryPriceKrw - 1 : null;
                const pnl = episode.status === 'closed' ? episode.realizedPnlKrw : episode.unrealizedPnlKrw;
                return (
                  <tr key={`${episode.persona}-${episode.symbol}-${episode.openDate}-${episode.closeDate ?? 'open'}`}>
                    <td>{episode.openDate}</td>
                    <td>
                      {episode.closeDate ?? <span className="badge badge-success badge-soft">보유중</span>}
                      <div className="text-xs text-base-content/55">{episode.status}</div>
                    </td>
                    <td className="num">{formatDays(episode.holdingDays)}</td>
                    <td className="num">
                      {episode.buyFills ?? 0} / {episode.sellFills ?? 0}
                    </td>
                    <td className="num">
                      <Money
                        native={episode.avgEntryPriceNative}
                        krw={episode.avgEntryPriceKrw}
                        currency={episode.currency}
                      />
                    </td>
                    <td className="num">
                      <Money
                        native={episode.avgExitPriceNative ?? episode.lastCloseNative}
                        krw={exitOrLast}
                        currency={episode.currency}
                      />
                    </td>
                    <td className={`num ${(stockReturn ?? 0) >= 0 ? 'good' : 'bad'}`}>{formatPercent(stockReturn)}</td>
                    <td className={`num ${(pnl ?? 0) >= 0 ? 'good' : 'bad'}`}>{formatKrw(pnl)}</td>
                    <td>{humanReason(episode.exitReasons)}</td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
        </div>
      </details>

      <details className="card min-w-0 border border-base-300 bg-base-100 shadow-sm">
        <summary className="cursor-pointer list-none p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h3 className="text-base font-bold tracking-tight">체결 원장</h3>
            <span className="text-xs text-base-content/55">{selectedTrades.length}건 체결 · 펼치기</span>
          </div>
        </summary>
        <div className="min-w-0 px-5 pb-5">
          <DataTable compact className="ledger-table-wrap">
            <thead>
              <tr>
                <th>일자</th>
                <th>구분</th>
                <th className="num">수량</th>
                <th className="num">체결가</th>
                <th className="num">체결금액</th>
                <th className="num">현금잔고</th>
                <th>사유</th>
                <th>리포트</th>
              </tr>
            </thead>
            <tbody>
              {selectedTrades.map((trade) => (
                <tr
                  key={`${trade.persona}-${trade.date}-${trade.side}-${trade.qty}-${trade.fillPriceKrw}-${trade.cashAfterKrw}`}
                >
                  <td>{trade.date}</td>
                  <td>
                    <span className={`badge badge-soft ${trade.side === 'buy' ? 'badge-success' : 'badge-warning'}`}>
                      {trade.side === 'buy' ? '매수' : '매도'}
                    </span>
                  </td>
                  <td className="num">{trade.qty?.toLocaleString('ko-KR') ?? '—'}</td>
                  <td className="num">
                    <Money native={trade.fillPriceNative} krw={trade.fillPriceKrw} currency={trade.currency} />
                  </td>
                  <td className="num">
                    <Money native={trade.grossNative} krw={trade.grossKrw} currency={trade.currency} />
                  </td>
                  <td className="num">{formatKrw(trade.cashAfterKrw)}</td>
                  <td>{humanReason(trade.reason)}</td>
                  <td>{trade.reportId ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </div>
      </details>
    </section>
  );
}

function SummaryStat({ label, value, caption }: { label: string; value: ReactNode; caption: string | null }) {
  return (
    <div className="rounded-md border border-base-200 bg-base-100 px-3 py-2.5">
      <dt className="text-xs uppercase tracking-[0.16em] text-base-content/55">{label}</dt>
      <dd className="mt-1 text-base font-bold tabular-nums text-base-content">{value}</dd>
      {caption ? <dd className="mt-0.5 text-xs text-base-content/55">{caption}</dd> : null}
    </div>
  );
}

function humanReason(reason: string): string {
  if (reason.includes('target_hit')) return '목표가 도달';
  if (reason.includes('stop')) return '손절/리스크 제한';
  if (reason.includes('rebalance_buy')) return '리밸런싱 매수';
  if (reason.includes('rebalance_sell')) return '리밸런싱 매도';
  if (reason.includes('time')) return '시간 손절';
  return reason.replace(/[()']/g, '') || '—';
}

function strategyDescription(persona: string): string {
  if (persona.includes('stop-loss') || persona.includes('stop_loss'))
    return '리포트 추종을 기본으로 하되 손절 기준을 함께 적용해 하방 훼손을 제한하는 전략입니다.';
  if (persona.includes('1/N')) return '동일 비중으로 리포트 종목을 분산 보유하는 단순 추종 전략입니다.';
  if (persona.includes('look-ahead')) return '사후적으로 유리한 구간을 확인하는 비교용 약한 예언자 벤치마크입니다.';
  return '선택한 페르소나의 종목별 진입·청산 활동입니다.';
}
