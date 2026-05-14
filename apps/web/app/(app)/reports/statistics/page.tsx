import { ReportStatisticsStory } from '@/components/reports/ReportStatisticsStory';
import { getReportStatisticsLabSummary } from '@/lib/artifacts';

export default function ReportStatisticsPage() {
  return <ReportStatisticsStory summary={getReportStatisticsLabSummary()} />;
}
