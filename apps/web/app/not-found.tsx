import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto grid min-h-dvh max-w-2xl place-items-center px-4 py-16 text-slate-900" id="main-content">
      <div className="grid gap-5 text-center">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">404 · Not Found</p>
        <h1 className="text-3xl font-semibold tracking-[-0.03em] text-slate-950 md:text-4xl">
          페이지를 찾을 수 없습니다
        </h1>
        <p className="text-sm leading-7 text-slate-600">
          요청하신 경로는 정적 빌드 결과물에 포함되어 있지 않거나, 스냅샷 이후 사라진 종목/리포트일 수 있습니다. 메인
          화면에서 다시 탐색해 주세요.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link
            className="inline-flex min-h-10 items-center rounded-md bg-slate-950 px-4 py-2.5 text-sm font-semibold leading-normal text-white transition-colors hover:bg-slate-800"
            href="/main"
          >
            메인으로 돌아가기
          </Link>
          <Link
            className="inline-flex min-h-10 items-center rounded-md border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold leading-normal text-slate-900 transition-colors hover:bg-slate-50"
            href="/reports"
          >
            리포트 목록 열기
          </Link>
        </div>
      </div>
    </main>
  );
}
