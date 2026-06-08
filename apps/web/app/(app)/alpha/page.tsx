import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { getAlphaHypotheses, getVerificationCases } from '@/lib/artifacts';
import { formatDateKo } from '@/lib/format';

export default function AlphaPage() {
  const hypotheses = getAlphaHypotheses();
  const verificationCases = getVerificationCases();

  return (
    <div className="grid gap-4">
      <section className="rounded-md border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Alpha</p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">승격 규칙 보드</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              어떤 반복 규칙이 검증 케이스 집합을 근거로 승격되거나 탈락하는지 먼저 봅니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/">Verification</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/portfolio">Portfolio Proof</Link>
            </Button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-slate-500">
          <span>alpha 후보 {hypotheses.length.toLocaleString('ko-KR')}건</span>
          <span>검증 케이스 {verificationCases.length.toLocaleString('ko-KR')}건</span>
        </div>
      </section>

      <section className="overflow-hidden rounded-md border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-950">AlphaHypothesis board</h2>
          <p className="mt-1 text-xs text-slate-500">반복 규칙의 근거 케이스 수, 종목 수, 기간 범위를 함께 봅니다.</p>
        </div>
        <div className="overflow-x-auto px-4 py-2">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                <th className="px-0 py-2">규칙</th>
                <th className="px-3 py-2 text-right">케이스 수</th>
                <th className="px-3 py-2 text-right">종목 수</th>
                <th className="px-3 py-2 text-right">구간 수</th>
                <th className="px-3 py-2">상태</th>
              </tr>
            </thead>
            <tbody>
              {hypotheses.length ? (
                hypotheses.map((row) => (
                  <tr className="border-b border-slate-100 last:border-b-0" key={row.hypothesisId}>
                    <td className="px-0 py-2.5">
                      <div className="font-medium text-slate-900">{row.selectionRule}</div>
                      <div className="font-mono text-xs text-slate-500">
                        {row.supportStartDate ? formatDateKo(row.supportStartDate) : '-'} ~{' '}
                        {row.supportEndDate ? formatDateKo(row.supportEndDate) : '-'}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-700">{row.supportCount}</td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-700">
                      {row.distinctSymbolCount}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-700">{row.regimeCount}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-600">{row.promotionStatus}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-0 py-6 text-sm text-slate-500" colSpan={5}>
                    alpha artifact가 아직 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
