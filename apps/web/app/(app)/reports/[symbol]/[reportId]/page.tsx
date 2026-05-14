import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ReportDetailView } from '@/components/reports/ReportDetailView';
import { getReportById, getReportRows, hasPriceArtifact } from '@/lib/artifacts';

type ReportParams = Promise<{ symbol: string; reportId: string }>;

export function generateStaticParams() {
  return getReportRows()
    .filter((report) => hasPriceArtifact(report.symbol))
    .map((report) => ({ symbol: report.symbol, reportId: report.reportId }));
}

export async function generateMetadata({ params }: { params: ReportParams }): Promise<Metadata> {
  const { symbol, reportId } = await params;
  const report = selectReport(decodeURIComponent(symbol), reportId);
  return { title: report ? `${report.company} — 리포트 분석` : '리포트 분석' };
}

export default async function ReportDetailByIdPage({ params }: { params: ReportParams }) {
  const { symbol, reportId } = await params;
  const report = selectReport(decodeURIComponent(symbol), reportId);
  if (!report) notFound();
  return <ReportDetailView report={report} />;
}

function selectReport(symbol: string, reportId: string) {
  const report = getReportById(reportId);
  if (!report || report.symbol.toUpperCase() !== symbol.toUpperCase()) return undefined;
  return report;
}
