'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { PositionEpisodeRow, TradeRow } from '@/lib/artifacts';
import { formatDays, formatKrw, formatPercent } from '@/lib/format';
import { DEFAULT_PERSONA } from '@/components/trading/TableControls';
import { DataTable, TableCard } from '@/components/ui/DataTable';
import { Price } from '@/components/ui/Price';
import { SegmentedControl } from '@/components/ui/SegmentedControl';

type Props = {
  symbol: string;
  episodes: PositionEpisodeRow[];
  trades: TradeRow[];
  personaLabels: Record<string, string>;
};

export function SymbolPersonaTrades({ symbol, episodes, trades, personaLabels }: Props) {
  const personas = useMemo(() => {
    const ids = Array.from(new Set([...episodes.map((row) => row.persona), ...trades.map((row) => row.persona)])).filter(Boolean).sort();
    return ids.sort((a, b) => Number(b === DEFAULT_PERSONA) - Number(a === DEFAULT_PERSONA) || (personaLabels[a] ?? a).localeCompare(personaLabels[b] ?? b, 'ko-KR'));
  }, [episodes, personaLabels, trades]);
  const [persona, setPersona] = useState(() => personas.includes(DEFAULT_PERSONA) ? DEFAULT_PERSONA : (personas[0] ?? ''));
  const selectedEpisodes = useMemo(() => episodes.filter((row) => row.persona === persona), [episodes, persona]);
  const selectedTrades = useMemo(() => trades.filter((row) => row.persona === persona), [persona, trades]);
  const realizedPnl = selectedEpisodes.reduce((sum, row) => sum + (row.realizedPnlKrw ?? 0), 0);
  const unrealizedPnl = selectedEpisodes.reduce((sum, row) => sum + (row.unrealizedPnlKrw ?? 0), 0);
  const openPositions = selectedEpisodes.filter((row) => row.status === 'open').length;
  const recentTrades = selectedTrades.slice(0, 5);

  if (!personas.length) {
    return (
      <section id="persona-trades" className="panel anchor-section trade-ledger">
        <h2>페르소나별 매매 내역</h2>
        <p className="muted">{symbol}에 연결된 전략 매매 내역이 없습니다.</p>
      </section>
    );
  }

  return (
    <section id="persona-trades" className="panel anchor-section trade-ledger">
      <div className="section-headline trade-ledger__header">
        <div>
          <h2>페르소나별 매매 내역</h2>
          <p className="muted">전략별로 {symbol}을 어떻게 진입·증액·축소했는지 성과와 활동 흐름을 먼저 확인합니다.</p>
        </div>
        <Link className="mini-link secondary" href={`/portfolio?strategy=${persona}`}>포트폴리오 원장</Link>
      </div>
      <SegmentedControl
        ariaLabel="페르소나 선택"
        className="compact trade-ledger__tabs"
        value={persona}
        onChange={setPersona}
        options={personas.map((item) => ({ id: item, label: personaLabels[item] ?? item }))}
      />
      <article className="trade-activity-card">
        <div>
          <span className="dossier-card__label">Strategy activity</span>
          <h3>{personaLabels[persona] ?? persona}</h3>
          <p>{strategyDescription(persona)}</p>
        </div>
        <div className="trade-activity-card__stats">
          <span><strong>{openPositions}</strong> 보유 포지션</span>
          <span><strong>{selectedTrades.length}</strong> 누적 체결</span>
          <span><strong className={realizedPnl + unrealizedPnl >= 0 ? 'good' : 'bad'}>{formatKrw(realizedPnl + unrealizedPnl)}</strong> 총 손익</span>
        </div>
      </article>
      <div className="trade-summary-grid">
        <div className="param"><dt>포지션</dt><dd>{selectedEpisodes.length.toLocaleString('ko-KR')}개</dd></div>
        <div className="param"><dt>체결</dt><dd>{selectedTrades.length.toLocaleString('ko-KR')}건</dd></div>
        <div className="param"><dt>실현손익</dt><dd className={realizedPnl >= 0 ? 'good' : 'bad'}>{formatKrw(realizedPnl)}</dd></div>
        <div className="param"><dt>미실현손익</dt><dd className={unrealizedPnl >= 0 ? 'good' : 'bad'}>{formatKrw(unrealizedPnl)}</dd></div>
      </div>

      <div className="trade-lifecycle-grid">
        <div className="position-card-list" aria-label="포지션 생애주기 요약">
          {selectedEpisodes.slice(0, 3).map((episode) => {
            const exitOrLast = episode.avgExitPriceKrw ?? episode.lastCloseKrw;
            const stockReturn = episode.avgEntryPriceKrw && exitOrLast ? exitOrLast / episode.avgEntryPriceKrw - 1 : null;
            return (
              <article className="position-card" key={`${episode.persona}-${episode.symbol}-${episode.openDate}`}>
                <div className="position-card__topline">
                  <strong>{episode.status === 'open' ? '보유 중' : '청산 완료'}</strong>
                  <span>{formatDays(episode.holdingDays)}</span>
                </div>
                <div className="position-card__route">
                  <span>{episode.openDate}</span>
                  <i />
                  <span>{episode.closeDate ?? '현재'}</span>
                </div>
                <div className="position-card__prices">
                  <span><em>진입</em><Price native={episode.avgEntryPriceNative} krw={episode.avgEntryPriceKrw} currency={episode.currency} /></span>
                  <span><em>최근/청산</em><Price native={episode.avgExitPriceNative ?? episode.lastCloseNative} krw={exitOrLast} currency={episode.currency} /></span>
                </div>
                <strong className={(stockReturn ?? 0) >= 0 ? 'good' : 'bad'}>{formatPercent(stockReturn)}</strong>
              </article>
            );
          })}
        </div>
        <div className="execution-tape" aria-label="최근 체결 활동">
          <div className="execution-tape__head">
            <strong>최근 체결 흐름</strong>
            <span>{recentTrades.length.toLocaleString('ko-KR')}건 표시</span>
          </div>
          {recentTrades.map((trade) => (
            <div className="trade-event" key={`event-${trade.persona}-${trade.date}-${trade.side}-${trade.qty}-${trade.fillPriceKrw}`}>
              <span className={`trade-event__dot ${trade.side === 'buy' ? 'buy' : 'sell'}`} />
              <div>
                <strong>{trade.side === 'buy' ? '매수' : '매도'} {trade.qty?.toLocaleString('ko-KR') ?? '—'}주</strong>
                <span>{trade.date} · {humanReason(trade.reason)}</span>
              </div>
              <Price native={trade.fillPriceNative} krw={trade.fillPriceKrw} currency={trade.currency} />
            </div>
          ))}
        </div>
      </div>

      <TableCard title="포지션 생애주기" meta={`${selectedEpisodes.length.toLocaleString('ko-KR')}개 포지션`}>
        <DataTable compact className="ledger-table-wrap">
          <thead><tr><th>매수 시작</th><th>매도/상태</th><th className="num">보유일</th><th className="num">매수/매도</th><th className="num">평균 진입</th><th className="num">평균 청산/최근</th><th className="num">종목 수익률</th><th className="num">손익</th><th>매도 기준</th></tr></thead>
          <tbody>{selectedEpisodes.map((episode) => {
            const exitOrLast = episode.avgExitPriceKrw ?? episode.lastCloseKrw;
            const stockReturn = episode.avgEntryPriceKrw && exitOrLast ? exitOrLast / episode.avgEntryPriceKrw - 1 : null;
            const pnl = episode.status === 'closed' ? episode.realizedPnlKrw : episode.unrealizedPnlKrw;
            return (
              <tr key={`${episode.persona}-${episode.symbol}-${episode.openDate}-${episode.closeDate ?? 'open'}`}>
                <td>{episode.openDate}</td>
                <td>{episode.closeDate ?? <span className="pill good">보유중</span>}<div className="muted">{episode.status}</div></td>
                <td className="num">{formatDays(episode.holdingDays)}</td>
                <td className="num">{episode.buyFills ?? 0} / {episode.sellFills ?? 0}</td>
                <td className="num"><Price native={episode.avgEntryPriceNative} krw={episode.avgEntryPriceKrw} currency={episode.currency} /></td>
                <td className="num"><Price native={episode.avgExitPriceNative ?? episode.lastCloseNative} krw={exitOrLast} currency={episode.currency} /></td>
                <td className={`num ${(stockReturn ?? 0) >= 0 ? 'good' : 'bad'}`}>{formatPercent(stockReturn)}</td>
                <td className={`num ${(pnl ?? 0) >= 0 ? 'good' : 'bad'}`}>{formatKrw(pnl)}</td>
                <td>{humanReason(episode.exitReasons)}</td>
              </tr>
            );
          })}</tbody>
        </DataTable>
      </TableCard>

      <TableCard title="체결 원장" meta={`${selectedTrades.length.toLocaleString('ko-KR')}건 체결`}>
        <DataTable compact className="ledger-table-wrap">
          <thead><tr><th>일자</th><th>구분</th><th className="num">수량</th><th className="num">체결가</th><th className="num">체결금액</th><th className="num">현금잔고</th><th>사유</th><th>리포트</th></tr></thead>
          <tbody>{selectedTrades.map((trade) => (
            <tr key={`${trade.persona}-${trade.date}-${trade.side}-${trade.qty}-${trade.fillPriceKrw}-${trade.cashAfterKrw}`}>
              <td>{trade.date}</td>
              <td><span className={`pill ${trade.side === 'buy' ? 'good' : 'warn'}`}>{trade.side === 'buy' ? '매수' : '매도'}</span></td>
              <td className="num">{trade.qty?.toLocaleString('ko-KR') ?? '—'}</td>
              <td className="num"><Price native={trade.fillPriceNative} krw={trade.fillPriceKrw} currency={trade.currency} /></td>
              <td className="num"><Price native={trade.grossNative} krw={trade.grossKrw} currency={trade.currency} /></td>
              <td className="num">{formatKrw(trade.cashAfterKrw)}</td>
              <td>{humanReason(trade.reason)}</td>
              <td>{trade.reportId ?? '—'}</td>
            </tr>
          ))}</tbody>
        </DataTable>
      </TableCard>
    </section>
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
  if (persona.includes('stop-loss') || persona.includes('stop_loss')) return '리포트 추종을 기본으로 하되 손절 기준을 함께 적용해 하방 훼손을 제한하는 전략입니다.';
  if (persona.includes('1/N')) return '동일 비중으로 리포트 종목을 분산 보유하는 단순 추종 전략입니다.';
  if (persona.includes('look-ahead')) return '사후적으로 유리한 구간을 확인하는 비교용 약한 예언자 벤치마크입니다.';
  return '선택한 페르소나의 종목별 진입·청산 활동입니다.';
}
