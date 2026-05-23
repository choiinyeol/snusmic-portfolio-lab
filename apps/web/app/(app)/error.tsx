'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('SNUSMIC app route error', error);
  }, [error]);

  return (
    <section className="mx-auto grid max-w-2xl gap-5 py-10" role="alert" aria-live="assertive">
      <div className="grid gap-2">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Runtime error</p>
        <h1 className="text-2xl font-semibold text-slate-950">화면을 그리는 중에 문제가 발생했습니다</h1>
        <p className="text-sm leading-7 text-slate-600">
          이 페이지의 아티팩트가 손상되었거나, 클라이언트 컴포넌트가 예상치 못한 값을 받았을 수 있습니다. 다시 시도해도
          같은 오류가 반복되면 신호 보드로 돌아간 뒤 다른 종목이나 계좌 리포트로 진입해 주세요.
        </p>
        {error.digest ? <p className="font-mono text-xs text-slate-400">digest: {error.digest}</p> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-10 items-center rounded-md bg-slate-950 px-4 py-2.5 text-sm font-semibold leading-normal text-white transition-colors hover:bg-slate-800"
        >
          다시 시도
        </button>
        <Link
          className="inline-flex min-h-10 items-center rounded-md border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold leading-normal text-slate-900 transition-colors hover:bg-slate-50"
          href="/"
        >
          신호 보드로 이동
        </Link>
      </div>
    </section>
  );
}
