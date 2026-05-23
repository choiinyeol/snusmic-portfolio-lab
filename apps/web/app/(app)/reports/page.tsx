import { ReportBoardScreen } from '@/components/reports/ReportBoardScreen';
import { getReportBoardViewModel } from '@/lib/view-models/report-board';

export default function ReportsPage() {
  const model = getReportBoardViewModel();
  return <ReportBoardScreen model={model} />;
}
