'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { formatPercent } from '@/lib/format';

const LAB_STEPS = [
  {
    id: 'overview',
    title: 'Overview',
    badge: '30초 진단',
    href: '/',
    summary: '평가액, 현금, 목표가 적중률, 벤치마크 대비 성과를 먼저 봅니다.',
    details: [
      '현재 평가액에 현금이 포함되는지 확인',
      '목표가 도달률은 필터링된 리포트 기준',
      '차트는 벤치마크와 고유 전략을 분리해서 해석',
    ],
  },
  {
    id: 'portfolio',
    title: 'Portfolio',
    badge: '원장',
    href: '/portfolio',
    summary: '전략별 share-based 원장, 현금 비중, 보유·체결 내역을 확인합니다.',
    details: [
      '현금은 대기 자금이며 성과 계산에 포함',
      '매도 후 즉시 매수하지 않는 이유는 후보 조건 미충족일 수 있음',
      '체결 테이프로 전략의 실제 행동을 검증',
    ],
  },
  {
    id: 'reports',
    title: 'Reports',
    badge: '검증 테이블',
    href: '/reports',
    summary: '같은 컬럼 테이블에서 정렬·필터 프리셋만 바꿔 리포트를 읽습니다.',
    details: [
      '가격 없음·매도 의견·비실행성 케이스는 제외',
      '달성률은 (현재가-진입가)/(목표가-진입가)',
      '검색·정렬·필터·페이지네이션은 표의 기본 기능',
    ],
  },
  {
    id: 'strategies',
    title: 'Strategies',
    badge: '목표 게이트',
    href: '/strategies',
    summary: '벤치마크와 고유 전략을 분리하고 MDD 15% 이하 + KOSPI 초과를 확인합니다.',
    details: [
      '벤치마크는 비교 기준선이지 선택 전략이 아님',
      'Weak Prophet은 미래정보 상한선으로만 해석',
      '고유 전략은 broker-ledger 기반 persona에서 승격',
    ],
  },
  {
    id: 'screener',
    title: 'Screener',
    badge: '후보 탐색',
    href: '/screener',
    summary: '미도달·미만료 리포트 중 설명 가능한 후보를 찾아봅니다.',
    details: [
      '목표 진행률, 현재 수익률, 잔여 업사이드 조합으로 해석',
      '후보는 매수 지시가 아니라 검토 대상',
      '표본 수와 데이터 품질을 같이 확인',
    ],
  },
] as const;

const BENCHMARKS = ['All-Weather', 'Follower v1', 'Follower SL', 'KODEX200', 'QQQ', 'SPY', 'GLD', 'Weak Prophet'];
const STRATEGIES = ['MTT #1', 'MTT #2', 'MTT #3', 'MTT #4', 'MTT #5'];

export function GuideExperience() {
  const [activeStep, setActiveStep] = useState<(typeof LAB_STEPS)[number]['id']>('overview');
  const [entryPrice, setEntryPrice] = useState(10000);
  const [currentPrice, setCurrentPrice] = useState(13000);
  const [targetPrice, setTargetPrice] = useState(15000);
  const [returnPct, setReturnPct] = useState(0.28);
  const [drawdownPct, setDrawdownPct] = useState(0.15);

  const step = LAB_STEPS.find((item) => item.id === activeStep) ?? LAB_STEPS[0];
  const targetProgress = useMemo(() => {
    const denominator = targetPrice - entryPrice;
    if (denominator === 0) return null;
    return Math.max(0, Math.min(1, (currentPrice - entryPrice) / denominator));
  }, [currentPrice, entryPrice, targetPrice]);
  const passesObjective = returnPct > 0.2 && drawdownPct <= 0.15;

  return (
    <div className="grid gap-5">
      <section className="guide-hero-3d lab-panel p-4 md:p-5" aria-label="Portfolio Lab interactive overview">
        <div className="guide-hero-copy">
          <span className="snapshot-pill">Interactive guide</span>
          <h2>Portfolio Lab을 읽는 방법</h2>
          <p>
            이 페이지는 튜토리얼입니다. 포트폴리오, 리포트, 전략 화면에서 어떤 질문을 던져야 하는지 예시로 보여줍니다.
          </p>
          <div className="guide-chip-row" aria-label="Core principles">
            <span>Reports = 링크명 일치</span>
            <span>표 = 공유 컬럼</span>
            <span>현금 = 평가액 포함</span>
            <span>벤치마크 ≠ 선택 전략</span>
          </div>
        </div>
        <div className="guide-orbit" aria-hidden="true">
          <div className="guide-orbit__ring" />
          <div className="guide-orbit__card guide-orbit__card--front">
            <strong>Portfolio</strong>
            <span>현금 포함 AUM</span>
          </div>
          <div className="guide-orbit__card guide-orbit__card--mid">
            <strong>Reports</strong>
            <span>공유 컬럼 테이블</span>
          </div>
          <div className="guide-orbit__card guide-orbit__card--back">
            <strong>Strategies</strong>
            <span>MDD ≤ 15%</span>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,.95fr)]">
        <article className="lab-panel p-4 md:p-5">
          <div className="lab-panel__eyebrow">Lab Flow</div>
          <h2 className="mt-1 text-xl font-black tracking-[-0.04em]">클릭해서 화면별 목적 보기</h2>
          <div className="guide-step-tabs" role="tablist" aria-label="Guide sections">
            {LAB_STEPS.map((item) => (
              <button
                aria-selected={item.id === activeStep}
                className="guide-step-tab"
                key={item.id}
                onClick={() => setActiveStep(item.id)}
                role="tab"
                type="button"
              >
                <span>{item.title}</span>
                <small>{item.badge}</small>
              </button>
            ))}
          </div>
          <div className="guide-device" aria-live="polite">
            <div className="guide-device__topbar">
              <span />
              <span />
              <span />
              <strong>{step.title}</strong>
            </div>
            <div className="guide-device__body">
              <div>
                <span className="badge badge-primary badge-soft">{step.badge}</span>
                <h3>{step.summary}</h3>
              </div>
              <ul>
                {step.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
              <Link className="btn btn-sm btn-primary" href={step.href}>
                {step.title} 열기
              </Link>
            </div>
          </div>
        </article>

        <article className="guide-tilt-card lab-panel p-4 md:p-5">
          <div className="lab-panel__eyebrow">3D Mental Model</div>
          <h2 className="mt-1 text-xl font-black tracking-[-0.04em]">세 레이어로 해석하세요</h2>
          <div className="guide-stack" aria-label="Three layer model">
            <div className="guide-stack__layer guide-stack__layer--top">
              <span>UI</span>
              <strong>정렬·필터·차트</strong>
            </div>
            <div className="guide-stack__layer guide-stack__layer--middle">
              <span>Semantics</span>
              <strong>벤치마크/전략/현금 분리</strong>
            </div>
            <div className="guide-stack__layer guide-stack__layer--bottom">
              <span>Data</span>
              <strong>기준일 데이터</strong>
            </div>
          </div>
          <p className="mt-5 text-sm leading-6 text-base-content/62">
            예쁜 카드보다 중요한 것은 의미의 분리입니다. 같은 데이터는 같은 표에서 보고, 다른 의미의 데이터는 처음부터
            레이어를 분리합니다.
          </p>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="lab-panel p-4 md:p-5">
          <div className="lab-panel__eyebrow">Target Progress Simulator</div>
          <h2 className="mt-1 text-xl font-black tracking-[-0.04em]">목표가 달성률 공식 체험</h2>
          <p className="mt-2 text-sm leading-6 text-base-content/62">
            달성률 = (현재가 - 진입가) / (목표가 - 진입가). 단순 현재가/목표가가 아닙니다.
          </p>
          <div className="guide-slider-grid">
            <Slider label="진입가" value={entryPrice} min={5000} max={20000} step={500} onChange={setEntryPrice} />
            <Slider label="현재가" value={currentPrice} min={5000} max={22000} step={500} onChange={setCurrentPrice} />
            <Slider label="목표가" value={targetPrice} min={8000} max={26000} step={500} onChange={setTargetPrice} />
          </div>
          <div className="guide-progress-card">
            <div>
              <span>계산 결과</span>
              <strong>{formatPercent(targetProgress)}</strong>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-base-200">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.min(100, (targetProgress ?? 0) * 100)}%` }}
              />
            </div>
          </div>
        </article>

        <article className="lab-panel p-4 md:p-5">
          <div className="lab-panel__eyebrow">Objective Gate</div>
          <h2 className="mt-1 text-xl font-black tracking-[-0.04em]">개인 목표 게이트</h2>
          <p className="mt-2 text-sm leading-6 text-base-content/62">
            목표는 MDD 15% 이하이면서 KOSPI/KODEX200보다 더 많이 오르는 전략입니다.
          </p>
          <div className="guide-slider-grid">
            <Slider
              label="전략 수익률"
              value={Math.round(returnPct * 100)}
              min={-20}
              max={80}
              step={1}
              suffix="%"
              onChange={(value) => setReturnPct(value / 100)}
            />
            <Slider
              label="MDD"
              value={Math.round(drawdownPct * 100)}
              min={0}
              max={50}
              step={1}
              suffix="%"
              onChange={(value) => setDrawdownPct(value / 100)}
            />
          </div>
          <div className={`guide-objective ${passesObjective ? 'guide-objective--pass' : 'guide-objective--fail'}`}>
            <div>
              <span>판정</span>
              <strong>{passesObjective ? '통과 후보' : '보류 / 개선 필요'}</strong>
            </div>
            <p>
              {passesObjective
                ? '수익률과 낙폭 조건을 동시에 만족합니다.'
                : '수익률이 좋아도 MDD가 15%를 넘으면 목표를 통과하지 않습니다.'}
            </p>
          </div>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="lab-panel p-4 md:p-5">
          <div className="lab-panel__eyebrow">Benchmark Map</div>
          <h2 className="mt-1 text-xl font-black tracking-[-0.04em]">비교 기준선</h2>
          <div className="guide-token-grid">
            {BENCHMARKS.map((item) => (
              <span className="guide-token guide-token--benchmark" key={item}>
                {item}
              </span>
            ))}
          </div>
        </article>
        <article className="lab-panel p-4 md:p-5">
          <div className="lab-panel__eyebrow">Selectable Strategies</div>
          <h2 className="mt-1 text-xl font-black tracking-[-0.04em]">사용자가 검토할 고유 전략</h2>
          <div className="guide-token-grid">
            {STRATEGIES.map((item) => (
              <span className="guide-token guide-token--strategy" key={item}>
                {item}
              </span>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  suffix = '원',
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="guide-slider">
      <span>{label}</span>
      <strong>
        {value.toLocaleString('ko-KR')}
        {suffix}
      </strong>
      <input
        aria-label={label}
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        step={step}
        type="range"
        value={value}
      />
    </label>
  );
}
