import Link from 'next/link';
import { KpiTile } from '@/components/ui/KpiTile';
import { PageHero } from '@/components/ui/PageHero';
import { Section } from '@/components/ui/Section';
import { formatPercent } from '@/lib/format';
import { OBJECTIVE_MAX_DRAWDOWN } from '@/lib/product-model';

const flow = [
  ['1', 'Overview', '현재 평가액, 현금, 목표가 적중률, 벤치마크 대비 성과를 30초 안에 확인합니다.'],
  ['2', 'Portfolio', '전략별 share-based 원장, 현금 비중, 현재 보유, 체결 기록을 검토합니다.'],
  ['3', 'Reports', '발간가→현재가→목표가 흐름을 같은 컬럼 테이블에서 정렬·필터링합니다.'],
  ['4', 'Strategies', '벤치마크와 고유 전략을 분리하고, MDD 15% 이하 + KOSPI 초과 목표를 확인합니다.'],
  ['5', 'Screener', '미도달·미만료 리포트 중 업사이드와 목표 진행률이 설명 가능한 후보를 찾습니다.'],
] as const;

const terms = [
  {
    term: 'MWR',
    title: 'Money-Weighted Return',
    body: '입금·출금 시점까지 반영한 투자자 관점 수익률입니다. 단순 가격 수익률보다 원장형 포트폴리오에 적합합니다.',
  },
  {
    term: 'MDD',
    title: 'Maximum Drawdown',
    body: '고점 대비 최대 낙폭입니다. 이 프로젝트의 개인 목표는 MDD 15% 이하에서 KOSPI/KODEX200보다 높은 수익률입니다.',
  },
  {
    term: 'Target Progress',
    title: '목표가 진행률',
    body: '공식은 (현재가 - 진입가) / (목표가 - 진입가)입니다. 목표가를 이미 넘으면 100% 이상이 아니라 도달 상태로 해석합니다.',
  },
  {
    term: 'Benchmark',
    title: '비교 기준선',
    body: 'All-Weather, SMIC Follower v1/v2, KODEX200, QQQ, SPY, GLD, Weak Prophet은 전략이 아니라 비교 기준입니다.',
  },
] as const;

export default function GuidePage() {
  return (
    <>
      <PageHero
        eyebrow="GUIDE"
        title="SNUSMIC Portfolio Lab 사용 가이드"
        subtitle="이 서비스는 실시간 거래 도구가 아니라, 커밋된 정적 아티팩트로 리서치 추천·포트폴리오 원장·전략 성과를 검증하는 대시보드입니다."
        badges={[
          { label: 'Mode', value: 'Static Artifacts' },
          { label: 'Trading', value: 'No live trading' },
          { label: 'Tables', value: 'Sort · Filter · Pagination' },
          { label: 'Objective', value: `MDD ≤ ${formatPercent(OBJECTIVE_MAX_DRAWDOWN)}` },
        ]}
        actions={
          <>
            <Link className="btn btn-sm btn-primary" href="/portfolio">
              Portfolio 시작
            </Link>
            <Link className="btn btn-sm btn-outline" href="/reports">
              Reports 보기
            </Link>
          </>
        }
      />

      <Section eyebrow="Workflow" title="30초 이해 플로우">
        <div className="grid gap-3 md:grid-cols-5">
          {flow.map(([step, title, body]) => (
            <article className="lab-panel p-4" key={title}>
              <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 font-mono font-black text-primary">
                {step}
              </div>
              <h2 className="text-base font-black tracking-[-0.02em]">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-base-content/60">{body}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section eyebrow="Principles" title="화면을 읽는 원칙">
        <div className="grid gap-3 lg:grid-cols-3">
          <KpiTile
            label="표 기본 원칙"
            value="정렬·필터·페이지네이션"
            delta="같은 데이터는 하나의 공유 컬럼 테이블"
            tone="accent"
          />
          <KpiTile
            label="전략 분류"
            value="벤치마크 ≠ 고유 전략"
            delta="비교 기준선과 선택 가능 전략을 분리"
            tone="neutral"
          />
          <KpiTile label="현금 처리" value="평가액에 포함" delta="매도 후 대기 자금은 현금 비중으로 표시" tone="good" />
        </div>
      </Section>

      <Section eyebrow="Interactive examples" title="예시로 보는 해석">
        <div className="grid gap-3 lg:grid-cols-3">
          <GuideDetail title="목표가 진행률이 60%라면?">
            진입가 10,000원, 목표가 15,000원, 현재가 13,000원이면 (13,000 - 10,000) / (15,000 - 10,000) = 60%입니다.
            목표가에 가까워질수록 추가 상승 여력은 줄어듭니다.
          </GuideDetail>
          <GuideDetail title="팔았는데 왜 현금으로 남나요?">
            원장 전략은 항상 즉시 재매수하지 않습니다. 리밸런싱 주기, 최대 보유 종목 수, MTT/업사이드/가격 조건을 모두
            통과한 후보가 없으면 현금으로 대기합니다.
          </GuideDetail>
          <GuideDetail title="Weak Prophet은 왜 벤치마크인가요?">
            미래정보 상한선에 가까운 비교 기준입니다. 현실적인 매매 전략처럼 선택하는 대상이 아니라, 다른 전략이 얼마나
            과장되었는지 감지하기 위한 기준선입니다.
          </GuideDetail>
        </div>
      </Section>

      <Section eyebrow="Glossary" title="금융·포트폴리오 용어">
        <div className="grid gap-3 md:grid-cols-2">
          {terms.map((item) => (
            <article className="lab-panel p-4" key={item.term}>
              <div className="flex items-center gap-2">
                <span className="badge badge-primary badge-soft">{item.term}</span>
                <h2 className="font-black">{item.title}</h2>
              </div>
              <p className="mt-3 text-sm leading-6 text-base-content/62">{item.body}</p>
            </article>
          ))}
        </div>
      </Section>
    </>
  );
}

function GuideDetail({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="lab-panel p-4" open>
      <summary className="cursor-pointer text-sm font-black tracking-[-0.01em]">{title}</summary>
      <p className="mt-3 text-sm leading-6 text-base-content/62">{children}</p>
    </details>
  );
}
