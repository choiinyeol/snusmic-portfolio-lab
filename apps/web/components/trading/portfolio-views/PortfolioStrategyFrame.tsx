'use client';

import Link from 'next/link';
import { useSelectedLayoutSegment } from 'next/navigation';
import type { ReactNode } from 'react';
import type { PortfolioViewModel } from './types';

const ROUTE_LINKS = [
  { view: 'overview', label: '요약', segment: null },
  { view: 'holdings', label: '보유', segment: 'holdings' },
  { view: 'equity', label: '손익', segment: 'equity' },
  { view: 'trades', label: '거래', segment: 'trades' },
  { view: 'methodology', label: '규칙', segment: 'methodology' },
] as const;

type PortfolioRouteSegment = (typeof ROUTE_LINKS)[number]['segment'];

export function PortfolioStrategyFrame({ children, model }: { children: ReactNode; model: PortfolioViewModel }) {
  const segment = useSelectedLayoutSegment() as PortfolioRouteSegment;
  const persona = model.selectedPersona;
  const baseHref = `/portfolio/${encodeURIComponent(persona)}`;
  const activeSegment = ROUTE_LINKS.some((link) => link.segment === segment) ? segment : null;

  return (
    <div className="grid min-w-0 gap-4">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-white p-3">
        <div className="min-w-0">
          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            portfolio report
          </div>
          <p className="mt-1 text-sm font-semibold text-slate-950">
            상세 화면에서는 전략을 다시 고르지 않고, 선택/비교는 상위 화면에서 처리합니다.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link
            className="inline-flex min-h-10 items-center rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold leading-normal text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
            href="/portfolio"
          >
            ← 포트폴리오 선택
          </Link>
          <Link
            className="inline-flex min-h-10 items-center rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold leading-normal text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
            href="/strategies"
          >
            전략 비교
          </Link>
        </div>
        {model.invalidStrategyId ? (
          <div className="mt-3 basis-full rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
            요청한 전략 <code>{model.invalidStrategyId}</code>는 현재 포트폴리오 원장에 없습니다. 벤치마크 원장은
            포트폴리오에서 제외하고, 기본 전략 기준으로 표시합니다.
          </div>
        ) : null}
      </div>

      <nav
        aria-label="포트폴리오 상세 보기"
        className="min-w-0 overflow-x-auto rounded-md border border-slate-200 bg-white p-1.5"
      >
        <div className="flex min-w-max items-center gap-1">
          <span className="mr-1 px-2 text-xs font-semibold text-slate-400">보고서 섹션</span>
          {ROUTE_LINKS.map((link) => {
            const active = activeSegment === link.segment;
            const href = link.segment ? `${baseHref}/${link.segment}` : baseHref;
            return (
              <Link
                aria-current={active ? 'page' : undefined}
                className={[
                  'inline-flex min-h-10 items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-semibold leading-normal transition-colors',
                  active
                    ? 'border-slate-950 bg-slate-950 !text-white [&>span]:!text-white'
                    : 'border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-950',
                ].join(' ')}
                href={href}
                key={link.view}
              >
                <span className={active ? '!text-white' : undefined}>{link.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {children}
    </div>
  );
}
