import { ResearchCalendarScreen } from '@/components/research-calendar/ResearchCalendarScreen';
import { PageHeader } from '@/components/ui/PageHeader';
import { MetricStrip } from '@/components/ui/MetricStrip';
import { getResearchCalendarViewModel } from '@/lib/view-models/research-calendar';

export default function CalendarPage() {
  const model = getResearchCalendarViewModel();

  return (
    <div className="grid gap-4">
      <PageHeader header={model.header} metrics={<MetricStrip metrics={model.metrics} />} />
      <ResearchCalendarScreen model={model} />
    </div>
  );
}
