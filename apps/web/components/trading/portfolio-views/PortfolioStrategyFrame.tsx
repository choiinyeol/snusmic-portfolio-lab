'use client';

import Link from 'next/link';
import { useSelectedLayoutSegment } from 'next/navigation';
import type { ReactNode } from 'react';
import { StrategySelector } from '@/components/trading/StrategySelector';
import type { PortfolioViewModel } from './types';

const ROUTE_LINKS = [
  { view: 'overview', label: '개요', segment: null },
  { view: 'holdings', label: '현재 보유', segment: 'holdings' },
  { view: 'equity', label: '일별 평가액', segment: 'equity' },
  { view: 'trades', label: '매매내역', segment: 'trades' },
  { view: 'methodology', label: '운용 규칙', segment: 'methodology' },
] as const;

type PortfolioRouteSegment = (typeof ROUTE_LINKS)[number]['segment'];

export function PortfolioStrategyFrame({ children, model }: { children: ReactNode; model: PortfolioViewModel }) {
  const segment = useSelectedLayoutSegment() as PortfolioRouteSegment;
  const persona = model.selectedPersona;
  const baseHref = `/portfolio/${encodeURIComponent(persona)}`;
  const activeSegment = ROUTE_LINKS.some((link) => link.segment === segment) ? segment : null;

  return (
    <div className="grid min-w-0 gap-4">
      <div className="lab-panel p-3 md:p-4">
        <div className="grid min-w-0 gap-2">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
            <span className="snapshot-pill">포트폴리오 전략</span>
            <span className="text-xs font-bold text-slate-950/45">
              실제 운용 원장 {model.strategyOptions.length.toLocaleString('ko-KR')}개
            </span>
          </div>
          <StrategySelector ariaLabel="포트폴리오 전략 선택" options={model.strategyOptions} value={persona} />
        </div>
        {model.invalidStrategyId ? (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
            요청한 전략 <code>{model.invalidStrategyId}</code>는 현재 포트폴리오 원장에 없습니다. 벤치마크 원장은
            포트폴리오에서 제외하고, 기본 전략 기준으로 표시합니다.
          </div>
        ) : null}
      </div>

      <nav
        aria-label="포트폴리오 상세 보기"
        className="min-w-0 overflow-x-auto border-y border-slate-200 bg-white py-1"
      >
        <div className="flex min-w-max gap-1 px-1">
          {ROUTE_LINKS.map((link) => {
            const active = activeSegment === link.segment;
            const href = link.segment ? `${baseHref}/${link.segment}` : baseHref;
            const meta = routeMeta(link.segment, model);
            return (
              <Link
                aria-current={active ? 'page' : undefined}
                className={[
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-colors',
                  active
                    ? 'bg-slate-950 !text-white [&>span]:!text-white'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950',
                ].join(' ')}
                href={href}
                key={link.view}
              >
                <span className={active ? '!text-white' : undefined}>{link.label}</span>
                {meta ? <span className={active ? '!text-white/65' : 'text-slate-400'}>{meta}</span> : null}
              </Link>
            );
          })}
        </div>
      </nav>

      {children}
    </div>
  );
}

function routeMeta(segment: PortfolioRouteSegment, model: PortfolioViewModel): string | null {
  if (segment === 'holdings') return model.holdings.length.toLocaleString('ko-KR');
  if (segment === 'equity')
    return model.equity.filter((row) => row.persona === model.selectedPersona).length.toString();
  if (segment === 'trades') return model.trades.length.toLocaleString('ko-KR');
  if (segment === 'methodology') return model.methodsByPersona[model.selectedPersona] ? '기록' : null;
  return null;
}
