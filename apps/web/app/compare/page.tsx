import Link from 'next/link';
import { getArtifactManifest } from '@/lib/artifacts';
import { formatDateKo, formatKrw, formatPercent, signedTextClass } from '@/lib/format';
import {
  getBenchmarkRows,
  getDefaultPortfolioPersona,
  getExecutiveOverview,
  getObjectivePassingRows,
  getSelectableStrategyRows,
  getStrategyLeaderboard,
} from '@/lib/product-model';

const DECISION_CRITERIA = [
  {
    label: '첫 판단 속도',
    v1: '리포트·전략·포트폴리오가 모두 같은 카드 밀도로 보임',
    v2: '첫 화면에서 “현재 스냅샷 판단”을 먼저 보여주는 구조',
  },
  {
    label: '고급스러움',
    v1: '대시보드 템플릿에 금융 컴포넌트를 끼운 인상',
    v2: '편집된 금융 리서치 제품처럼 여백, 대비, 숫자 위계를 재설계',
  },
  {
    label: '비교 가능성',
    v1: '구현 결과를 보고 막연히 좋다/나쁘다 판단',
    v2: 'V1/v0.13.0과 V2 branch 차이를 앱 안에서 직접 점검',
  },
  {
    label: '유지보수',
    v1: 'PageHero/Section/Panel 조합이 화면마다 반복됨',
    v2: '소수의 결정 영역과 증거 영역으로 컴포넌트 책임 축소',
  },
];

const V2_RULES = [
  '큰 hero와 균등 카드 나열보다 판단 문장과 핵심 증거를 먼저 둔다.',
  '숫자는 크게 만들기보다 의미·기준선·위험을 같이 보여준다.',
  '벤치마크, 오라클, 고유 전략을 시각적으로 섞지 않는다.',
  '리포트 후보는 매수 추천이 아니라 재검토할 근거로 표현한다.',
  '새 branch의 성공 여부는 “더 예쁜가”가 아니라 “더 빨리 이해되는가”로 판단한다.',
];

const SOURCE_AUDIT = [
  {
    label: 'V1 기준',
    title: 'main / v0.13.0',
    href: 'https://github.com/ChoiInYeol/snusmic-portfolio-lab/blob/v0.13.0/apps/web/app/page.tsx',
    items: [
      '홈 라우트: apps/web/app/page.tsx',
      '지문: PageHero · Section · Panel · KpiTile',
      '상태: 이미 push된 비교 기준',
    ],
  },
  {
    label: 'V2 현재',
    title: 'redesign/v2-product-shell',
    href: 'https://github.com/ChoiInYeol/snusmic-portfolio-lab/tree/redesign/v2-product-shell',
    items: [
      '홈 라우트: v2-decision · v2-board · v2-evidence',
      '비교 라우트: /compare',
      '상태: 같은 artifact를 읽는 개편 브랜치',
    ],
  },
];

const OBSERVABLE_COMPARISON = [
  {
    label: '첫 5초 판단',
    v1: 'V1 홈은 PageHero 다음에 KPI와 여러 Section/Panel이 같은 밀도로 이어져 “무엇부터 판단할지”를 사용자가 고릅니다.',
    v2: 'V2 홈은 “오늘 이 스냅샷은 이렇게 읽습니다”라는 판단 문장, 평가액/MWR/목표 도달 3개 수치, 원장 검토 CTA를 먼저 둡니다.',
    judge: '화면을 열고 5초 안에 대표 원장과 리스크/목표 상태를 말할 수 있으면 V2 승리입니다.',
  },
  {
    label: '정보 구조',
    v1: 'V1은 포트폴리오, 리포트, 성과, 업데이트, 매수 테이프가 동일한 카드 문법으로 병렬 배치됩니다.',
    v2: 'V2는 판단 → 포트폴리오 리스크 → 전략 성과 → 증거 피드 순서로 읽히도록 보드 책임을 분리했습니다.',
    judge: '스크롤 순서가 투자 리서치 검토 순서처럼 느껴지면 V2가 더 낫습니다.',
  },
  {
    label: '비교 가능성',
    v1: 'V1에는 개편 결과를 검토하는 별도 라우트가 없어 느낌으로만 비교해야 했습니다.',
    v2: 'V2는 이 /compare 라우트에서 기준 태그, 현재 브랜치, 실제 artifact 수치, 판단 기준을 한 화면에 고정합니다.',
    judge: '사용자가 “좋다/싫다”가 아니라 어떤 기준에서 나아졌는지 말할 수 있으면 통과입니다.',
  },
  {
    label: '코드 지문',
    v1: 'V1 홈 라우트는 PageHero/Section/Panel/KpiTile/StrategySelector 조합으로 화면을 조립합니다.',
    v2: 'V2 홈 라우트는 기존 범용 래퍼를 쓰지 않고, 의사결정·보드·증거 영역을 route-owned 구조로 직접 구성합니다.',
    judge: '코드가 템플릿 조립보다 제품 화면의 읽기 순서를 설명하면 V2 방향이 맞습니다.',
  },
];

export default function ComparePage() {
  const manifest = getArtifactManifest();
  const strategyRows = getStrategyLeaderboard();
  const selectable = getSelectableStrategyRows(strategyRows);
  const benchmarks = getBenchmarkRows(strategyRows);
  const objectiveRows = getObjectivePassingRows(strategyRows);
  const overview = getExecutiveOverview(getDefaultPortfolioPersona());
  const bestStrategy = selectable[0];
  const benchmark = benchmarks.find((row) => row.id === 'benchmark_kodex200') ?? benchmarks[0];
  const snapshotDate = overview.snapshotDate || manifest.price_range.end || manifest.report_range.end || '';

  return (
    <main className="compare-page">
      <section className="compare-hero" aria-labelledby="compare-title">
        <div className="compare-hero__copy">
          <p className="compare-kicker">V2 REDESIGN BRANCH</p>
          <h1 id="compare-title">끼워맞춘 대시보드를 버리고, 제품으로 다시 설계합니다.</h1>
          <p>
            이 브랜치는 pushed <strong>v0.13.0</strong>을 망가뜨리지 않고 V2를 비교하기 위한 실험입니다. 사용자는 이
            화면과 스냅샷 화면을 오가며 “새로 짠 방향이 진짜 더 나은가?”를 판단할 수 있습니다.
          </p>
          <div className="compare-actions">
            <Link className="btn btn-primary" href="/">
              V2 스냅샷 보기
            </Link>
            <Link className="btn btn-outline" href="/guide">
              읽는 법 확인
            </Link>
          </div>
        </div>
        <aside className="compare-hero__panel" aria-label="현재 비교 기준">
          <div>
            <span>비교 기준</span>
            <strong>main / v0.13.0</strong>
          </div>
          <div>
            <span>현재 브랜치</span>
            <strong>redesign/v2-product-shell</strong>
          </div>
          <div>
            <span>스냅샷 기준일</span>
            <strong>{formatDateKo(snapshotDate)}</strong>
          </div>
          <div>
            <span>검증 데이터</span>
            <strong>{manifest.row_counts.reports.toLocaleString('ko-KR')}개 리포트</strong>
          </div>
        </aside>
      </section>

      <section className="compare-section" aria-labelledby="decision-title">
        <div className="compare-section__head">
          <p className="compare-kicker">DECISION BOARD</p>
          <h2 id="decision-title">최종 비교 기준</h2>
          <p>V2가 성공하려면 단순히 더 화려하면 안 됩니다. 아래 네 가지가 명확히 좋아져야 합니다.</p>
        </div>
        <div className="compare-grid compare-grid--criteria">
          {DECISION_CRITERIA.map((criterion) => (
            <article className="compare-card" key={criterion.label}>
              <h3>{criterion.label}</h3>
              <dl>
                <div>
                  <dt>V1 / v0.13.0</dt>
                  <dd>{criterion.v1}</dd>
                </div>
                <div>
                  <dt>V2 목표</dt>
                  <dd>{criterion.v2}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section className="compare-section compare-audit" aria-labelledby="audit-title">
        <div className="compare-section__head">
          <p className="compare-kicker">EVIDENCE, NOT CLAIMS</p>
          <h2 id="audit-title">비교는 느낌이 아니라 기준·코드 지문·현재 화면으로 합니다</h2>
          <p>
            아래 내용은 같은 artifact를 읽는 두 방향의 비교 지문입니다. V1은 push된 v0.13.0 홈 라우트, V2는 현재 브랜치
            홈과 이 비교 라우트를 기준으로 삼습니다.
          </p>
        </div>
        <div className="compare-source-grid">
          {SOURCE_AUDIT.map((source) => (
            <article className="compare-source-card" key={source.label}>
              <span>{source.label}</span>
              <h3>{source.title}</h3>
              <ul>
                {source.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <Link href={source.href}>소스 기준 열기</Link>
            </article>
          ))}
        </div>
        <div className="compare-observable">
          {OBSERVABLE_COMPARISON.map((row) => (
            <article className="compare-observable__row" key={row.label}>
              <h3>{row.label}</h3>
              <div>
                <span>V1에서 보이는 증거</span>
                <p>{row.v1}</p>
              </div>
              <div>
                <span>V2에서 확인할 증거</span>
                <p>{row.v2}</p>
              </div>
              <strong>{row.judge}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="compare-section compare-snapshot" aria-labelledby="snapshot-title">
        <div className="compare-section__head">
          <p className="compare-kicker">LIVE ARTIFACT SNAPSHOT</p>
          <h2 id="snapshot-title">같은 데이터로 더 나은 판단을 만들어야 합니다</h2>
          <p>V2는 데이터를 바꾸는 프로젝트가 아닙니다. 같은 artifact를 더 좋은 정보 구조로 보여주는 실험입니다.</p>
        </div>
        <div className="compare-metrics" aria-label="현재 artifact 기반 비교 수치">
          <Metric
            label="현재 평가액"
            value={formatKrw(overview.portfolio.finalEquityKrw)}
            caption={overview.portfolio.label}
          />
          <Metric
            label="Primary MWR"
            value={formatPercent(overview.portfolio.moneyWeightedReturn)}
            caption={`MDD ${formatPercent(overview.portfolio.maxDrawdown)}`}
            tone={signedTextClass(overview.portfolio.moneyWeightedReturn)}
          />
          <Metric
            label="목표가 도달"
            value={formatPercent(overview.reportStats.targetHitRate)}
            caption={`${overview.reportStats.hitCount}/${overview.reportStats.total}건`}
          />
          <Metric
            label="최고 전략"
            value={bestStrategy?.shortLabel || bestStrategy?.label || '—'}
            caption={benchmark ? `기준선 ${benchmark.shortLabel}` : `${objectiveRows.length}개 목표 통과`}
          />
        </div>
      </section>

      <section className="compare-section" aria-labelledby="rules-title">
        <div className="compare-section__head">
          <p className="compare-kicker">V2 RULES</p>
          <h2 id="rules-title">이번 브랜치에서 지킬 삭제 기준</h2>
        </div>
        <ol className="compare-rules">
          {V2_RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ol>
      </section>
    </main>
  );
}

function Metric({
  label,
  value,
  caption,
  tone = 'text-base-content',
}: {
  label: string;
  value: string;
  caption?: string;
  tone?: string;
}) {
  return (
    <article className="compare-metric">
      <p>{label}</p>
      <strong className={tone}>{value}</strong>
      {caption ? <span>{caption}</span> : null}
    </article>
  );
}
