import { ArrowUpRight, Database, Target, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatPct } from "@/lib/utils";

type Kpis = {
  total: number;
  priced: number;
  up: number;
  targetHits: number;
  median: number | null;
};

const items = [
  { key: "total", label: "필터 결과", icon: Database },
  { key: "priced", label: "가격 매칭", icon: Trophy },
  { key: "targetHits", label: "목표가 도달", icon: Target },
  { key: "up", label: "상승 마감", icon: ArrowUpRight },
] as const;

export function SummaryKpis({ kpis }: { kpis: Kpis }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="요약 KPI">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.key} className="rounded-xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{kpis[item.key].toLocaleString("ko-KR")}</p>
              </div>
              <Icon className="h-5 w-5 text-[hsl(var(--finance-selected))]" aria-hidden="true" />
            </div>
          </Card>
        );
      })}
      <Card className="rounded-xl p-4 sm:col-span-2 xl:col-span-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">필터 결과 중앙값 수익률</p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{formatPct(kpis.median)}</p>
      </Card>
    </section>
  );
}
