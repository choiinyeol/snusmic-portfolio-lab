import { ArrowRight, BarChart3, CheckCircle2, FileText, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { getArtifactManifest } from '@/lib/artifacts';
import { formatKrw, formatPercent } from '@/lib/format';
import { getExecutiveOverview } from '@/lib/product-model';

const principles = [
  '저장된 데이터로 리포트 목표가와 실제 매매를 대조',
  '전략 성과, 낙폭, RP이자를 같은 기준으로 비교',
  '불완전한 데이터와 제외 사유를 후보보다 먼저 노출',
];

const links = [
  { href: '/main', label: '메인화면', caption: '오늘 확인할 검토 대기열', icon: ShieldCheck },
  { href: '/portfolio', label: '포트폴리오', caption: '보유·RP·매매내역', icon: BarChart3 },
  { href: '/reports', label: '리포트', caption: '목표가 검증과 제외 사유', icon: FileText },
  { href: '/statistics', label: '리포트 통계', caption: '분포·경로·익절선 실험', icon: BarChart3 },
];

export default function LandingPage() {
  const overview = getExecutiveOverview();
  const manifest = getArtifactManifest();
  const portfolio = overview.portfolio;

  return (
    <main className="min-h-dvh bg-[#f7f8fb] text-slate-950">
      <header className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link className="flex items-center gap-3" href="/" aria-label="SNUSMIC Portfolio Lab">
          <span className="grid size-8 place-items-center rounded-lg bg-slate-950 text-xs font-semibold text-white">
            SM
          </span>
          <span className="grid leading-tight">
            <span className="text-sm font-semibold tracking-tight">SNUSMIC</span>
            <span className="text-xs text-slate-500">Portfolio Lab</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-slate-600 md:flex" aria-label="주요 링크">
          <Link className="hover:text-slate-950" href="/reports">
            리포트
          </Link>
          <Link className="hover:text-slate-950" href="/portfolio">
            포트폴리오
          </Link>
        </nav>
        <Button asChild size="sm" variant="secondary">
          <Link href="/main">
            앱 열기 <ArrowRight />
          </Link>
        </Button>
      </header>

      <section className="mx-auto grid max-w-7xl gap-12 px-5 py-14 sm:px-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,.95fr)] lg:items-center lg:py-24">
        <div className="max-w-3xl">
          <p className="mb-5 inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
            투자 리서치 · 포트폴리오 분석 · 전략 비교
          </p>
          <h1 className="text-4xl font-semibold tracking-[-0.045em] text-slate-950 sm:text-5xl lg:text-6xl">
            SNUSMIC Portfolio Lab
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            리포트가 실제로 맞았는지, 전략이 벤치마크보다 나았는지, 현재 포트폴리오가 어떤 근거로 구성됐는지를 저장된
            데이터 기준으로 확인합니다.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" variant="secondary">
              <Link href="/main">
                메인화면 <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/statistics">리포트 통계</Link>
            </Button>
          </div>
          <ul className="mt-10 grid gap-3 text-sm text-slate-600">
            {principles.map((item) => (
              <li className="flex items-start gap-3" key={item}>
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="border-y border-slate-200 bg-white/70 py-3">
          <div className="border-b border-slate-200 px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-semibold">검증 기준</div>
                <div className="mt-1 font-mono text-xs text-slate-500">
                  {overview.snapshotDate || manifest.price_range.end}
                </div>
              </div>
            </div>
          </div>
          <div className="grid divide-y divide-slate-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
            <Metric label="평가액" value={formatKrw(portfolio.finalEquityKrw)} />
            <Metric label="RP이자 비중" value={formatPercent(portfolio.cashWeight)} />
            <Metric label="리포트" value={`${manifest.row_counts.reports.toLocaleString('ko-KR')}건`} />
            <Metric label="전략" value={`${manifest.row_counts.strategy_catalog.toLocaleString('ko-KR')}개`} />
          </div>
          <div className="grid gap-1 border-t border-slate-200 p-3">
            {links.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-slate-50"
                  href={item.href}
                  key={item.href}
                >
                  <span className="grid size-8 place-items-center rounded-md border border-slate-200 bg-white text-slate-500">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-950">{item.label}</span>
                    <span className="block truncate text-xs text-slate-500">{item.caption}</span>
                  </span>
                  <ArrowRight className="size-4 text-slate-400" />
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-2 truncate font-mono text-xl font-semibold tabular-nums text-slate-950">{value}</div>
    </div>
  );
}
