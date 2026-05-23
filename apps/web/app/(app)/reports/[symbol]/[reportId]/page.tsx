import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ReportDetailView } from '@/components/reports/ReportDetailView';
import { getReportDetailStaticParams, getReportDetailViewModel } from '@/lib/view-models/report-detail';

type ReportParams = Promise<{ symbol: string; reportId: string }>;

export function generateStaticParams() {
  return getReportDetailStaticParams();
}

export async function generateMetadata({ params }: { params: ReportParams }): Promise<Metadata> {
  const { symbol, reportId } = await params;
  const model = selectReport(decodeURIComponent(symbol), reportId);
  return { title: model ? `${model.report.company} · 리포트 분석` : '리포트 분석' };
}

export default async function ReportDetailByIdPage({ params }: { params: ReportParams }) {
  const { symbol, reportId } = await params;
  const model = selectReport(decodeURIComponent(symbol), reportId);
  if (!model) notFound();
  return <ReportDetailView model={model} />;
}

function selectReport(symbol: string, reportId: string) {
  return getReportDetailViewModel(symbol, reportId);
}
