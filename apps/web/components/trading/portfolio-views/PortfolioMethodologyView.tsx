'use client';

import type { StrategyMethod } from './types';

export function PortfolioMethodologyView({
  method,
  personaLabel,
}: {
  method: StrategyMethod | undefined;
  personaLabel: string;
}) {
  if (!method) {
    return (
      <p className="rounded-md border border-slate-200 bg-white p-5 text-sm text-slate-500">
        이 포트폴리오 전략에는 기록된 운용 규칙이 없습니다.
      </p>
    );
  }
  return (
    <article className="lab-panel p-4">
      <div className="mb-3">
        <div className="lab-panel__eyebrow">운용 규칙</div>
        <h2 className="lab-panel__title">{personaLabel} 매수·매도 규칙</h2>
        <p className="mt-2 text-sm leading-6 text-slate-950/62">{method.summary}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <RuleList title="매수 판단" items={method.buyRules} />
        <RuleList title="매도 판단" items={method.sellRules} />
        <RuleList title="위험 관리" items={method.riskControls} />
      </div>
    </article>
  );
}

function RuleList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <h3 className="text-sm font-black">{title}</h3>
      <ul className="mt-2 grid gap-1.5 text-sm leading-5 text-slate-500">
        {items.length ? (
          items.map((item) => <li key={item}>• {item}</li>)
        ) : (
          <li className="text-slate-950/45">기록된 규칙이 없습니다.</li>
        )}
      </ul>
    </div>
  );
}
