import { CheckCircle2, FileWarning, Target, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dateLabel, getDisplayName, type ReportRecord } from "@/lib/report-model";
import { cn, formatPct, formatPrice } from "@/lib/utils";

function verdict(report: ReportRecord) {
  if (report.data_issue) return { label: "가격 이슈", icon: FileWarning, className: "text-[hsl(var(--finance-warning))]" };
  if (report.target_hit_until_latest) return { label: "목표가 도달", icon: CheckCircle2, className: "text-[hsl(var(--finance-positive))]" };
  if (report.return_latest_pct !== null && report.return_latest_pct >= 0) return { label: "상승했지만 목표 미도달", icon: Target, className: "text-[hsl(var(--finance-warning))]" };
  return { label: "하락/미도달", icon: XCircle, className: "text-[hsl(var(--finance-negative))]" };
}

export function JudgementCard({ report }: { report: ReportRecord }) {
  const result = verdict(report);
  const Icon = result.icon;
  const positive = (report.return_latest_pct ?? 0) >= 0;
  const remaining = report.target_price && report.latest_close ? (report.target_price / report.latest_close - 1) * 100 : null;

  return (
    <Card className="sticky top-4 rounded-xl" aria-label="선택 리포트 판정 카드">
      <CardHeader className="border-b pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-xl leading-tight">{getDisplayName(report)}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{dateLabel(report.report_date)} · {report.market} · {report.ticker}</p>
          </div>
          <Icon className={cn("h-6 w-6 shrink-0", result.className)} aria-hidden="true" />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant="outline">{report.rating ?? "No rating"}</Badge>
          <Badge className={cn("border", result.className, result.label.includes("도달") ? "bg-[hsl(var(--finance-positive-bg))]" : "bg-[hsl(var(--finance-warning-bg))]")}>{result.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="grid gap-3">
          <Metric label="목표가" value={formatPrice(report.target_price, report.market)} emphasis />
          <Metric label="리포트 현재가" value={formatPrice(report.report_current_price, report.market)} />
          <Metric label="PIT 시작가" value={formatPrice(report.start_close, report.market)} />
          <Metric label="최신가" value={formatPrice(report.latest_close, report.market)} />
          <Metric label="최신 수익률" value={formatPct(report.return_latest_pct)} tone={positive ? "positive" : "negative"} emphasis />
          <Metric label="최대 상승률" value={formatPct(report.max_high_return_pct)} tone="positive" />
          <Metric label="최초 목표 도달일" value={dateLabel(report.first_target_hit_date)} />
          <Metric label="목표 도달 소요일" value={report.days_to_target === null ? "—" : `${report.days_to_target.toLocaleString("ko-KR")}일`} />
        </div>
        <div className="mt-4 rounded-lg border bg-[hsl(var(--surface-subtle))] p-3 text-sm text-muted-foreground">
          {report.target_hit_until_latest ? (
            <span>목표가는 <b className="text-foreground">{dateLabel(report.first_target_hit_date)}</b>에 도달했습니다.</span>
          ) : report.target_price ? (
            <span>현재 목표가까지 남은 거리: <b className="text-foreground">{formatPct(remaining)}</b></span>
          ) : (
            <span>목표가 파싱 이슈가 있어 가격 성과만 표시합니다.</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, tone, emphasis }: { label: string; value: string; tone?: "positive" | "negative"; emphasis?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b pb-2 last:border-b-0 last:pb-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-right tabular-nums",
          emphasis ? "text-base font-bold" : "text-sm font-medium",
          tone === "positive" && "text-[hsl(var(--finance-positive))]",
          tone === "negative" && "text-[hsl(var(--finance-negative))]",
        )}
      >
        {value}
      </span>
    </div>
  );
}
