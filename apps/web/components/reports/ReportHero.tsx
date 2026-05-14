import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ReportRow } from '@/lib/artifacts';
import { formatDateKo, formatPercent } from '@/lib/format';
import { formatAssetPrice, reportEntryPrice, targetMoveLabel, type TargetStatus } from '@/lib/report-view-model';

type Props = {
  report: ReportRow;
  status: TargetStatus;
  markdownHref: string;
  pdfHref: string | null;
};

export function ReportHero({ report, status, markdownHref, pdfHref }: Props) {
  const entryPrice = reportEntryPrice(report);
  return (
    <header className="border-b border-slate-200 pb-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem] xl:items-end">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{report.symbol}</Badge>
            <Badge variant={badgeVariant(status.tone)}>{status.label}</Badge>
            {report.exchange ? <Badge variant="secondary">{report.exchange}</Badge> : null}
            <Badge variant="secondary">{report.currency}</Badge>
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.045em] text-slate-950 md:text-5xl">
            {report.company}
          </h1>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600 md:text-base">
            {report.title || `${report.company} 리포트`}를 발간가, 현재가, 목표가, 실제 전략 매매까지 한 화면에서 다시
            검증합니다. 핵심은 “맞았나”보다{' '}
            <strong className="font-semibold text-slate-950">언제 사고 얼마나 기다렸을 때 유리했는지</strong>입니다.
          </p>
          <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
            <Fact
              label="발간가"
              value={formatAssetPrice(entryPrice, report)}
              caption={formatDateKo(report.publicationDate)}
            />
            <Fact
              label="목표가"
              value={formatAssetPrice(report.targetPriceNative, report)}
              caption={`${formatPercent(report.targetUpsideAtPub)} ${targetMoveLabel(report)}`}
            />
            <Fact
              label="현재가"
              value={formatAssetPrice(report.lastCloseNative, report)}
              caption={`${formatDateKo(report.lastCloseDate)} · ${formatPercent(report.currentReturn)}`}
            />
          </div>
        </div>

        <aside className="grid gap-3 border-t border-slate-200 pt-4 xl:border-t-0 xl:pt-0">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs font-medium text-slate-500">판정</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{status.detail}</div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              발간일 {formatDateKo(report.publicationDate)}부터 최근 종가 {formatDateKo(report.lastCloseDate)}까지의
              가격 경로를 기준으로 계산합니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/reports">목록</Link>
            </Button>
            {pdfHref ? (
              <Button asChild size="sm" variant="outline">
                <a href={pdfHref}>PDF</a>
              </Button>
            ) : null}
            <Button asChild size="sm" variant="ghost">
              <a href={markdownHref}>Markdown</a>
            </Button>
          </div>
        </aside>
      </div>
    </header>
  );
}

function Fact({ label, value, caption }: { label: string; value: string; caption: string }) {
  return (
    <div className="min-w-0 border-l border-slate-200 pl-3">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 truncate font-mono text-lg font-semibold tabular-nums text-slate-950">{value}</div>
      <div className="mt-0.5 truncate text-xs text-slate-500">{caption}</div>
    </div>
  );
}

function badgeVariant(tone: TargetStatus['tone']): 'success' | 'warning' | 'destructive' | 'default' {
  if (tone === 'good') return 'success';
  if (tone === 'bad') return 'destructive';
  if (tone === 'warn') return 'warning';
  return 'default';
}
