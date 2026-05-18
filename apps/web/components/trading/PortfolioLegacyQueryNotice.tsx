'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

function portfolioStrategyHref(strategyId: string): string {
  return `/portfolio/${encodeURIComponent(strategyId)}`;
}

export function PortfolioLegacyQueryNotice({ validStrategyIds }: { validStrategyIds: string[] }) {
  const [invalidId, setInvalidId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get('strategy');
    if (!requested) return;
    if (validStrategyIds.includes(requested)) {
      window.location.replace(portfolioStrategyHref(requested));
      return;
    }
    setInvalidId(requested);
  }, [validStrategyIds]);

  if (!invalidId) return null;
  return (
    <div className="mx-auto mb-4 w-full max-w-[1500px] px-4 pt-4 sm:px-6 lg:px-8">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
        <strong className="font-semibold">전략을 찾을 수 없습니다.</strong> 요청한 <code>{invalidId}</code>는 현재 전략
        산출물에 없습니다. 숨은 대체 표시로 다른 전략을 조용히 보여주지 않고, 현재 기본 전략 화면만 표시합니다.{' '}
        <Link className="font-semibold underline underline-offset-4" href="/strategies">
          전략 목록 보기
        </Link>
      </div>
    </div>
  );
}
