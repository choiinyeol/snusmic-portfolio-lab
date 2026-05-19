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
    <article className="grid gap-4">
      <section className="rounded-md border border-slate-200 bg-white p-4">
        <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          methodology
        </div>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">{personaLabel} 운용 방법론</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{method.summary}</p>
      </section>

      <section className="grid gap-3 lg:grid-cols-4">
        <MethodStep index="01" title="Entry · 진입" tone="slate" items={method.buyRules} />
        <MethodStep
          index="02"
          title="Rebalance · 편입/조정"
          tone="emerald"
          items={[
            '리포트 기반 후보 중 현재 원장 규칙을 통과한 종목만 실제 포지션으로 남깁니다.',
            '동일 전략 안에서는 현재 보유 원장과 체결 내역이 판단의 단일 source of truth입니다.',
          ]}
        />
        <MethodStep index="03" title="Exit / Risk · 청산" tone="rose" items={method.sellRules} />
        <MethodStep index="04" title="Exceptions · 예외" tone="amber" items={method.riskControls} />
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-4">
        <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          operating contract
        </div>
        <h3 className="mt-1 text-lg font-semibold tracking-tight text-slate-950">이 페이지가 보장하는 것</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <ContractCard
            title="실제 원장만"
            body="benchmark, follower, oracle은 비교 기준일 뿐 portfolio 원장에 섞지 않습니다."
          />
          <ContractCard
            title="거래로 검증"
            body="수익률 설명은 현재 보유와 실제 체결 ledger를 기준으로만 이어집니다."
          />
          <ContractCard
            title="근거로 이동"
            body="보유 종목은 최신 리포트 근거와 연결되어 왜 들고 있는지 추적할 수 있어야 합니다."
          />
        </div>
      </section>
    </article>
  );
}

function MethodStep({
  index,
  title,
  tone,
  items,
}: {
  index: string;
  title: string;
  tone: 'slate' | 'emerald' | 'rose' | 'amber';
  items: string[];
}) {
  const toneClass = {
    slate: 'bg-slate-950 text-white',
    emerald: 'bg-emerald-600 text-white',
    rose: 'bg-rose-600 text-white',
    amber: 'bg-amber-500 text-white',
  }[tone];
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <div className={`inline-flex h-7 items-center rounded px-2 font-mono text-xs font-black ${toneClass}`}>
        {index}
      </div>
      <h3 className="mt-3 text-base font-semibold tracking-tight text-slate-950">{title}</h3>
      <ul className="mt-3 grid gap-2 text-sm leading-6 text-slate-600">
        {items.length ? (
          items.map((item) => <li key={item}>• {item}</li>)
        ) : (
          <li className="text-slate-400">기록된 규칙이 없습니다.</li>
        )}
      </ul>
    </div>
  );
}

function ContractCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
      <h4 className="text-sm font-semibold text-slate-950">{title}</h4>
      <p className="mt-1 text-sm leading-5 text-slate-600">{body}</p>
    </div>
  );
}
