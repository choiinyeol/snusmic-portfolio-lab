import Link from 'next/link';
import { GuideExperience } from '@/components/guide/GuideExperience';
import { KpiTile } from '@/components/ui/KpiTile';
import { PageHero } from '@/components/ui/PageHero';
import { Section } from '@/components/ui/Section';
import { formatPercent } from '@/lib/format';
import { OBJECTIVE_MAX_DRAWDOWN } from '@/lib/product-model';

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
    body: '공식은 (현재가 - 진입가) / (목표가 - 진입가)입니다. 목표가를 이미 넘으면 도달 상태로 해석합니다.',
  },
  {
    term: 'Benchmark',
    title: '비교 기준선',
    body: 'All-Weather, SMIC Follower v1/v2, KODEX200, QQQ, SPY, GLD, Weak Prophet은 전략 선택지가 아니라 성과 비교 기준입니다.',
  },
  {
    term: 'Ledger',
    title: 'Share-based 원장',
    body: '수량, 현금, 평균단가, 매도·매수 내역을 보존하는 방식입니다. 단순 누적 수익률 차트보다 실제 매매 해석에 가깝습니다.',
  },
  {
    term: 'Read-only',
    title: '읽기 전용 대시보드',
    body: '실시간 주문·체결 기능은 없습니다. 정해진 기준일의 데이터로 리포트와 포트폴리오를 다시 읽는 화면입니다.',
  },
] as const;

export default function GuidePage() {
  return (
    <>
      <PageHero
        eyebrow="GUIDE"
        title="SNUSMIC Portfolio Lab 사용 가이드"
        subtitle="리서치, 포트폴리오, 전략 화면을 30초 안에 이해하고 각 화면에서 무엇을 봐야 하는지 익힙니다."
        badges={[
          { label: '데이터', value: '기준 데이터' },
          { label: '거래', value: '읽기 전용' },
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

      <Section eyebrow="사용 흐름" title="Portfolio Lab을 읽는 순서">
        <GuideExperience />
      </Section>

      <Section eyebrow="Principles" title="제품 UI/UX 원칙">
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

      <Section eyebrow="Glossary" title="금융·포트폴리오 용어">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {terms.map((item) => (
            <article className="guide-term-card lab-panel p-4" key={item.term}>
              <div className="flex items-center gap-2">
                <span className="badge badge-primary badge-soft">{item.term}</span>
                <h2 className="font-black">{item.title}</h2>
              </div>
              <p className="mt-3 text-sm leading-6 text-base-content/62">{item.body}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section eyebrow="Do not misread" title="이렇게 해석하면 안 됩니다">
        <div className="grid gap-3 lg:grid-cols-3">
          <GuideWarning title="투자 조언이 아닙니다">
            후보·전략·리포트 검증은 학습과 사후 분석을 위한 것입니다.
          </GuideWarning>
          <GuideWarning title="Weak Prophet은 전략이 아닙니다">미래정보 상한선 성격의 벤치마크입니다.</GuideWarning>
          <GuideWarning title="차트만 보지 않습니다">
            수익률은 MDD, 현금 비중, 거래 횟수, 표본 수와 함께 봅니다.
          </GuideWarning>
        </div>
      </Section>
    </>
  );
}

function GuideWarning({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="lab-panel border-warning/25 bg-warning/5 p-4">
      <span className="badge badge-warning badge-soft">주의</span>
      <h2 className="mt-3 font-black tracking-[-0.02em]">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-base-content/62">{children}</p>
    </article>
  );
}
