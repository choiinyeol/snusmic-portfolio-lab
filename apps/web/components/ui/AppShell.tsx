import Link from 'next/link';
import { APP_NAV, GITHUB_NAV_ITEM } from '@/components/ui/app-shell-nav';
import { SidebarNav } from '@/components/ui/SidebarNav';

type ShellMetric = {
  label: string;
  value: string;
  caption?: string;
};

type AppShellProps = {
  children: React.ReactNode;
  snapshotDate: string;
  reportCount: number;
  strategyCount: number;
  reportRange: DateRange;
  priceRange: DateRange;
  primaryBookLabel: string;
};

export function AppShell({
  children,
  snapshotDate,
  reportCount,
  strategyCount,
  reportRange,
  priceRange,
  primaryBookLabel,
}: AppShellProps) {
  const sidebarMetrics: ShellMetric[] = [
    { label: '기준일', value: snapshotDate || '—', caption: '확정 스냅샷' },
    { label: '리포트', value: `${reportCount.toLocaleString('ko-KR')}건`, caption: reportRangeLabel(reportRange) },
    { label: '가격', value: priceRange.end || '—', caption: reportRangeLabel(priceRange) },
    { label: '전략', value: `${strategyCount.toLocaleString('ko-KR')}개`, caption: primaryBookLabel },
  ];

  return (
    <div className="site-shell site-shell--v2">
      <aside className="v2-sidebar" aria-label="SNUSMIC Portfolio Lab navigation">
        <Link className="v2-brand" href="/" aria-label="SNUSMIC Portfolio Lab 홈">
          <span className="v2-brand__mark" aria-hidden="true">
            PL
          </span>
          <span className="v2-brand__copy">
            <strong>SNUSMIC</strong>
            <span>Portfolio Lab</span>
          </span>
        </Link>

        <div className="v2-branch-chip" aria-label="서비스 성격">
          <span>읽기 전용 랩</span>
          <strong>스냅샷 리서치 제품</strong>
        </div>

        <SidebarNav items={APP_NAV} />

        <section className="v2-snapshot-card" aria-label="기준 데이터 요약">
          <div className="v2-snapshot-card__head">
            <span>읽기 전용 기준 데이터</span>
            <i aria-hidden="true" />
          </div>
          <dl>
            {sidebarMetrics.map((metric) => (
              <div key={metric.label}>
                <dt>{metric.label}</dt>
                <dd>
                  <strong>{metric.value}</strong>
                  {metric.caption ? <span>{metric.caption}</span> : null}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <SidebarNav className="side-nav--utility" items={[GITHUB_NAV_ITEM]} />
      </aside>

      <div className="v2-workspace">
        <header className="v2-topbar">
          <div className="v2-topbar__title">
            <span>정적 리서치 스냅샷</span>
            <strong>리포트 → 원장 → 전략 검증</strong>
          </div>
          <div className="v2-topbar__facts" aria-label="스냅샷 상태">
            <span>{snapshotDate || '—'}</span>
            <span>{reportCount.toLocaleString('ko-KR')}개 리포트</span>
            <span>{strategyCount.toLocaleString('ko-KR')}개 전략</span>
            <Link href="/compare">개편 비교</Link>
          </div>
        </header>
        <div className="v2-main">{children}</div>
        <footer className="v2-footer">
          SNUSMIC Portfolio Lab · 기준 데이터 기반 읽기 전용 화면입니다. 실시간 주문·체결·투자 권유 기능은 없습니다.
        </footer>
      </div>
    </div>
  );
}

type DateRange = { start: string | null; end: string | null };

function reportRangeLabel(range: DateRange): string {
  if (!range.start && !range.end) return '범위 없음';
  if (range.start === range.end) return range.end ?? range.start ?? '—';
  return `${range.start || '—'} → ${range.end || '—'}`;
}
