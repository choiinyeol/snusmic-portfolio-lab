import { ReportStatisticsStory } from '@/components/reports/ReportStatisticsStory';
import { getReportStatisticsViewModel } from '@/lib/view-models/report-statistics';

export default function ReportStatisticsPage() {
  const model = getReportStatisticsViewModel();
  return <ReportStatisticsStory pricePaths={model.pricePaths} summary={model.summary} windowDays={model.windowDays} />;
}
