'use client';

import Link from 'next/link';
import type { StrategyMethod } from './types';

export function PortfolioMethodologyView({
  method,
  personaLabel,
  strategyId,
}: {
  method: StrategyMethod | undefined;
  personaLabel: string;
  strategyId: string;
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
          strategy playbook
        </div>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">{personaLabel} 운용 방법론</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{method.summary}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 active:bg-slate-950 active:text-white"
            href={`/portfolio/${strategyId}/holdings`}
          >
            현재 보유 보기
          </Link>
          <Link
            className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50 active:border-slate-950 active:bg-slate-950 active:text-white"
            href={`/portfolio/${strategyId}/trades`}
          >
            실제 매매 원장 보기
          </Link>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-4">
        <MethodStep index="01" title="Entry · 진입" tone="slate" items={method.buyRules} />
        <MethodStep
          index="02"
          title="Rebalance · 편입/조정"
          tone="emerald"
          items={[
            '정해진 주기마다 후보 점수를 다시 계산하고 상위 보유 수만 남깁니다.',
            '순위가 낮아진 보유 종목은 매도하고, 새 상위 후보로 교체합니다.',
            '보유/거래 탭에서 실제 편입·제외 날짜를 확인합니다.',
          ]}
        />
        <MethodStep index="03" title="Exit / Risk · 청산" tone="rose" items={method.sellRules} />
        <MethodStep index="04" title="Checks · 안전장치" tone="amber" items={method.riskControls} />
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-4">
        <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          operating settings
        </div>
        <h3 className="mt-1 text-lg font-semibold tracking-tight text-slate-950">사용자가 알아야 할 운용 설정</h3>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
          실제 매수·매도 판단에 직접 쓰이는 공개 설정만 표시합니다. 검증용 날짜, 내부 점수 원장, 후보 압축 실험값은
          숨깁니다.
        </p>
        <ParamGrid params={method.params} />
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-4">
        <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          what you can audit
        </div>
        <h3 className="mt-1 text-lg font-semibold tracking-tight text-slate-950">사용자가 직접 확인할 수 있는 것</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <ContractCard
            title="매수 가능 시점"
            body="주식 규칙은 첫 리포트 발간 뒤 투자 가능 종목으로 등록된 날짜부터만 편입 후보가 됩니다."
          />
          <ContractCard title="거래로 검증" body="수익률 설명은 현재 보유와 실제 체결 원장을 기준으로만 이어집니다." />
          <ContractCard
            title="리포트의 역할"
            body="가격 규칙에서 리포트는 매수 트리거가 아니라 투자 가능 universe에 들어온 근거입니다."
          />
        </div>
      </section>
    </article>
  );
}

function ParamGrid({ params }: { params: Record<string, unknown> }) {
  const entries = Object.entries(params).filter(([, value]) => value !== null && value !== undefined);
  if (!entries.length) return <p className="mt-3 text-sm text-slate-500">기록된 실제 파라미터가 없습니다.</p>;
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {entries.map(([key, value]) => (
        <div className="rounded-md border border-slate-100 bg-slate-50 p-3" key={key}>
          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            {formatParamKey(key)}
          </div>
          <div className="mt-1 break-words font-mono text-sm font-semibold tabular-nums text-slate-950">
            {formatParamValue(value)}
          </div>
        </div>
      ))}
    </div>
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

function formatParamKey(key: string): string {
  return key.replaceAll('_', ' ');
}

function formatParamValue(value: unknown): string {
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return value.toLocaleString('ko-KR');
    return value.toLocaleString('ko-KR', { maximumFractionDigits: 4 });
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(formatParamValue).join(', ');
  return JSON.stringify(value);
}
