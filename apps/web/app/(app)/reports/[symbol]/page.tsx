import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ReportDetailView } from '@/components/reports/ReportDetailView';
import { getReportBySymbol, getReportRows, hasPriceArtifact } from '@/lib/artifacts';

type ReportParams = Promise<{ symbol: string }>;

export function generateStaticParams() {
  return Array.from(new Set(getReportRows().map((report) => report.symbol)))
    .filter((symbol) => hasPriceArtifact(symbol))
    .map((symbol) => ({ symbol }));
}

export async function generateMetadata({ params }: { params: ReportParams }): Promise<Metadata> {
  const { symbol } = await params;
  const report = getReportBySymbol(decodeURIComponent(symbol));
  return { title: report ? `${report.company} — 리포트 분석` : '리포트 분석' };
}

export default async function ReportDetailPage({ params }: { params: ReportParams }) {
  const { symbol } = await params;
  const report = getReportBySymbol(decodeURIComponent(symbol));
  if (!report) notFound();
  return <ReportDetailView report={report} />;
}
