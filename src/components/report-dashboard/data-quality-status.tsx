import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { reportDataQuality } from "@/lib/report-model";
import { dateLabel } from "@/lib/report-model";

function formatGeneratedAt(value: string | null) {
  if (!value) return "알 수 없음";
  const [date = "", time = ""] = value.split("T");
  const clock = time.replace("Z", "").slice(0, 8);
  return clock ? `${date} ${clock} UTC` : value;
}

export function DataQualityStatus() {
  const clean = reportDataQuality.valid && reportDataQuality.dataIssueCount === 0 && reportDataQuality.parseIssueCount === 0;
  const Icon = clean ? CheckCircle2 : AlertTriangle;
  return (
    <section className="rounded-xl border bg-[hsl(var(--quality-bg))] p-4 text-[hsl(var(--quality))]" aria-label="데이터 품질 상태">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-3">
          <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-semibold">데이터 품질 / 생성 메타데이터</h2>
            <p className="mt-1 text-sm opacity-90">
              생성: {formatGeneratedAt(reportDataQuality.generatedAt)} · 기준일: {dateLabel(reportDataQuality.asOf)} · 유효 레코드 {reportDataQuality.validRecords}/{reportDataQuality.totalRecords}
            </p>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-5 gap-y-1 text-sm sm:grid-cols-5">
          <Metric label="schema" value={reportDataQuality.validationIssueCount} />
          <Metric label="data" value={reportDataQuality.dataIssueCount} />
          <Metric label="parse" value={reportDataQuality.parseIssueCount} />
          <Metric label="missing quote" value={reportDataQuality.missingQuoteCount} />
          <Metric label="missing target" value={reportDataQuality.missingTargetCount} />
        </dl>
      </div>
      {reportDataQuality.issueSummaries.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs opacity-90">
          {reportDataQuality.issueSummaries.map((issue) => <li key={issue}>{issue}</li>)}
        </ul>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-xs uppercase opacity-75">{label}</dt>
      <dd className="font-bold tabular-nums">{value}</dd>
    </div>
  );
}
