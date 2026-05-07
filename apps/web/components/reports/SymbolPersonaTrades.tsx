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
          <p className="muted">전략을 바꾸면 {symbol}을 언제 샀고, 언제 팔았는지 포지션과 체결 원장 단위로 확인합니다.</p>
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
      <div className="trade-summary-grid">
        <div className="param"><dt>포지션</dt><dd>{selectedEpisodes.length.toLocaleString('ko-KR')}개</dd></div>
        <div className="param"><dt>체결</dt><dd>{selectedTrades.length.toLocaleString('ko-KR')}건</dd></div>
        <div className="param"><dt>실현손익</dt><dd className={realizedPnl >= 0 ? 'good' : 'bad'}>{formatKrw(realizedPnl)}</dd></div>
        <div className="param"><dt>미실현손익</dt><dd className={unrealizedPnl >= 0 ? 'good' : 'bad'}>{formatKrw(unrealizedPnl)}</dd></div>
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
