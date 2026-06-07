import type { ReactNode } from 'react';
import Link from 'next/link';
import { PriceEvidenceChart } from '@/components/charts/PriceEvidenceChart';
import { Button } from '@/components/ui/button';
import { KpiTile } from '@/components/ui/KpiTile';
import { PageHero } from '@/components/ui/PageHero';
import { formatDateKo, formatDays, formatKrw, formatPercent } from '@/lib/format';
import { formatAssetPrice, targetMoveLabel, targetStatus } from '@/lib/report-view-model';
import type { ReportDetailViewModel } from '@/lib/view-models/report-detail';

export function ReportDetailView({ model }: { model: ReportDetailViewModel }) {
  const { report, priceSeries, entryPrice, captureRatio, stageLabel, sourceMetadata, trustStatus } = model;
  const status = targetStatus(report);
  const markdownHref = sourceMetadata.markdownRepositoryPath
    ? githubBlobUrl(sourceMetadata.markdownRepositoryPath)
    : null;
  const pdfHref = sourceMetadata.pdfRepositoryPath
    ? githubBlobUrl(sourceMetadata.pdfRepositoryPath)
    : sourceMetadata.pdfUrl;

  return (
    <div className="grid gap-5">
      <PageHero
        eyebrow="Report evidence"
        title={report.company}
        subtitle="발간가, 목표가, 이후 가격 경로, 현재 수익률을 같은 화면에서 검증합니다."
        badges={[
          { label: '종목', value: report.symbol },
          { label: '상태', value: status.label },
          { label: '발간일', value: formatDateKo(report.publicationDate) },
          { label: '거래소', value: report.exchange || report.currency },
        ]}
        actions={
          <>
            <Button asChild size="sm" variant="outline">
              <Link href="/reports">목록</Link>
            </Button>
            {pdfHref ? (
              <Button asChild size="sm" variant="outline">
                <a href={pdfHref}>PDF</a>
              </Button>
            ) : null}
            {markdownHref ? (
              <Button asChild size="sm" variant="outline">
                <a href={markdownHref}>Markdown</a>
              </Button>
            ) : null}
          </>
        }
        kpis={
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiTile
              compact
              label="현재 수익률"
              value={formatPercent(report.currentReturn)}
              tone={signedTone(report.currentReturn)}
            />
            <KpiTile compact label="최고 수익률" value={formatPercent(report.peakReturn)} tone="good" />
            <KpiTile
              compact
              label="목표 회수율"
              value={formatCapture(captureRatio)}
              caption="최고 수익률 / 목표 상승여력"
            />
            <KpiTile
              compact
              label="검증 단계"
              value={stageLabel}
              caption={report.targetHit ? formatDateKo(report.targetHitDate) : status.detail}
            />
          </div>
        }
      />

      <TrustStatusCard status={trustStatus} />

      <FactsTable
        rows={[
          { label: '발간일', value: formatDateKo(report.publicationDate) },
          { label: '만료일', value: formatDateKo(report.expiryDate) },
          { label: '최근 가격일', value: formatDateKo(report.lastCloseDate) },
          {
            label: '발간가',
            value: formatAssetPrice(entryPrice, report),
            caption: krwCaption(report.entryPriceKrw, report.currency),
          },
          {
            label: '목표가',
            value: formatAssetPrice(report.targetPriceNative, report),
            caption: combineCaption(targetMoveLabel(report), krwCaption(report.targetPriceKrw, report.currency)),
          },
          {
            label: '최근 종가',
            value: formatAssetPrice(report.lastCloseNative, report),
            caption: krwCaption(report.lastCloseKrw, report.currency),
          },
          { label: '제시 상승여력', value: formatPercent(report.targetUpsideAtPub) },
          { label: '현재 수익률', value: formatPercent(report.currentReturn), tone: signedTone(report.currentReturn) },
          { label: '최고 수익률', value: formatPercent(report.peakReturn), tone: 'good' },
          { label: '최저 수익률', value: formatPercent(report.troughReturn), tone: 'bad' },
          {
            label: '목표 잔여',
            value: formatPercent(report.targetRemainingPct),
            tone: signedTone(report.targetRemainingPct),
          },
          { label: '목표 진행률', value: formatPercent(report.targetProgressPct) },
          {
            label: '도달 정보',
            value: report.targetHit
              ? `${formatDateKo(report.targetHitDate)} · ${formatDays(report.daysToTarget)}`
              : '미도달',
          },
          { label: '목표 회수율', value: formatCapture(captureRatio), caption: '최고 / 목표' },
        ]}
      />

      <SourceAuditSection metadata={sourceMetadata} markdownHref={markdownHref} pdfHref={pdfHref} />

      <section className="grid gap-2" aria-labelledby="price-chart-heading">
        <h2
          className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500"
          id="price-chart-heading"
        >
          가격 경로
        </h2>
        <div className="rounded-md border border-slate-200 bg-white p-3">
          <PriceEvidenceChart
            priceSeries={priceSeries}
            targetPrice={report.targetPriceNative}
            entryPrice={entryPrice}
            currency={report.currency}
            publicationDate={report.publicationDate}
            targetHitDate={report.targetHitDate}
            expiryDate={report.expiryDate}
            evidenceMarkers={[]}
          />
        </div>
      </section>
    </div>
  );
}

type FactRow = {
  label: string;
  value: string;
  caption?: string;
  tone?: 'good' | 'bad';
};

function FactsTable({ rows }: { rows: FactRow[] }) {
  return (
    <section className="overflow-hidden rounded-md border border-slate-200 bg-white" aria-label="리포트 핵심 지표">
      <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 [&>div]:border-b [&>div]:border-r [&>div]:border-slate-100">
        {rows.map((row) => (
          <div className="grid min-w-0 gap-0.5 p-3" key={row.label}>
            <dt className="text-xs font-medium text-slate-500">{row.label}</dt>
            <dd className={`truncate font-mono text-sm font-semibold tabular-nums ${toneClass(row.tone)}`}>
              {row.value}
            </dd>
            {row.caption ? <dd className="truncate text-xs text-slate-500">{row.caption}</dd> : null}
          </div>
        ))}
      </dl>
    </section>
  );
}

type TrustStatus = ReportDetailViewModel['trustStatus'];

function TrustStatusCard({ status }: { status: TrustStatus }) {
  return (
    <section className={`rounded-md border p-3 ${trustStatusClass(status.level)}`} aria-label="리포트 신뢰 상태">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="grid gap-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Trust status
            </span>
            <span className="rounded-md bg-white/80 px-2 py-0.5 text-xs font-semibold text-slate-800 ring-1 ring-inset ring-slate-200">
              {status.label}
            </span>
          </div>
          <p className="text-sm font-medium text-slate-950">{status.summary}</p>
        </div>
        <ul className="grid gap-1 text-xs text-slate-600 md:min-w-72">
          {status.evidence.map((item) => (
            <li className="flex gap-2" key={item}>
              <span aria-hidden className="mt-1 h-1.5 w-1.5 rounded-full bg-current opacity-60" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function trustStatusClass(level: TrustStatus['level']): string {
  if (level === 'verified') return 'border-emerald-200 bg-emerald-50/60';
  if (level === 'review') return 'border-amber-200 bg-amber-50/70';
  return 'border-slate-200 bg-slate-50';
}
type SourceMetadata = ReportDetailViewModel['sourceMetadata'];

function SourceAuditSection({
  metadata,
  markdownHref,
  pdfHref,
}: {
  metadata: SourceMetadata;
  markdownHref: string | null;
  pdfHref: string | null;
}) {
  const caveatLabel = metadata.caveatFlags.length ? `${metadata.caveatFlags.length}개` : '없음';

  return (
    <section
      className="overflow-hidden rounded-md border border-slate-200 bg-white"
      aria-labelledby="source-audit-heading"
    >
      <div className="border-b border-slate-100 p-3">
        <h2
          className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500"
          id="source-audit-heading"
        >
          출처 / 원문 확인
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          리포트 식별자, 원문 PDF, 추출 Markdown 연결 상태를 표시합니다. 내부 진단 코드는 공개 화면에 노출하지 않습니다.
        </p>
      </div>
      <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 [&>div]:border-b [&>div]:border-r [&>div]:border-slate-100">
        <AuditItem label="Report ID" value={metadata.reportId} caption={metadata.title || '제목 미기록'} />
        <AuditItem
          label="PDF"
          value={metadata.pdfFilename ? '저장 PDF' : metadata.pdfUrl ? '원문 URL' : '없음'}
          caption={metadata.pdfRepositoryPath ?? metadata.pdfUrl ?? 'pdf_filename / pdf_url 미기록'}
          href={pdfHref}
        />
        <AuditItem
          label="Markdown"
          value={metadata.markdownFilename ? '추출 완료' : '없음'}
          caption={metadata.markdownRepositoryPath ?? 'markdown_filename 미기록'}
          href={markdownHref}
        />
        <AuditItem
          label="추출 주의"
          value={metadata.caveatFlags.length ? '원문 확인 필요' : '없음'}
          caption={metadata.caveatFlags.length ? `${caveatLabel} 항목` : '주의 항목 없음'}
        />
      </dl>
    </section>
  );
}

function AuditItem({
  label,
  value,
  caption,
  href,
  children,
}: {
  label: string;
  value: string;
  caption?: string;
  href?: string | null;
  children?: ReactNode;
}) {
  return (
    <div className="grid min-w-0 gap-0.5 p-3">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="truncate font-mono text-sm font-semibold tabular-nums text-slate-950">
        {href ? (
          <a className="underline decoration-slate-300 underline-offset-2 hover:text-slate-700" href={href}>
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
      {caption ? (
        <dd className="truncate text-xs text-slate-500" title={caption}>
          {caption}
        </dd>
      ) : null}
      {children}
    </div>
  );
}

function githubBlobUrl(path: string): string {
  return `https://github.com/ChoiInYeol/snusmic-portfolio-lab/blob/main/${encodeURI(path)}`;
}
function krwCaption(krw: number | null | undefined, currency: string | null | undefined): string | undefined {
  if (!krw || !Number.isFinite(krw)) return undefined;
  if ((currency ?? 'KRW').toUpperCase() === 'KRW') return undefined;
  return `약 ${formatKrw(krw)}`;
}

function combineCaption(a: string | undefined | null, b: string | undefined | null): string | undefined {
  const parts = [a, b].filter((value): value is string => Boolean(value));
  if (parts.length === 0) return undefined;
  return parts.join(' · ');
}

function formatCapture(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  return `${value.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}x`;
}

function signedTone(value: number | null | undefined): 'good' | 'bad' | undefined {
  if (value === null || value === undefined || !Number.isFinite(value)) return undefined;
  return value >= 0 ? 'good' : 'bad';
}

function toneClass(tone?: 'good' | 'bad'): string {
  if (tone === 'good') return 'text-emerald-600';
  if (tone === 'bad') return 'text-rose-600';
  return 'text-slate-950';
}
