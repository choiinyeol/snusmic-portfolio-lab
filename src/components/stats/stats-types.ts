/** stats.json 타입 — scripts/build_stats.py 출력과 1:1 대응 */

export type TierStat = {
  n: number;
  median: number | null;
  q1: number | null;
  q3: number | null;
  p10: number | null;
  p90: number | null;
};

export type FeatureSummary = {
  key: string;
  label: string;
  unit: string;
  desc: string;
  n: number;
  monotone: boolean;
  direction: number;
  lift_spread: number | null;
  best_bin_lift: number | null;
  is_top: boolean;
};

export type LiftBin = {
  label: string;
  lo: number | null;
  hi: number | null;
  n: number;
  success: number;
  p_pct: number | null;
  lift: number | null;
};

export type TopFactor = {
  key: string;
  label: string;
  unit: string;
  direction: number;
  monotone: boolean;
  threshold: number | null;
  cond: string;
  lift_spread: number | null;
  best_bin_lift: number | null;
};

export type FactorCheck = { key: string; value: number | null; pass: boolean | null };

export type Candidate = {
  ticker: string;
  market: string;
  slug: string;
  name: string;
  school: string;
  schools: string[];
  report_date: string;
  age_days: number;
  tier_now: string | null;
  stated_upside_pct: number | null;
  return_since_pct: number | null;
  score: number;
  checks: FactorCheck[];
  price_as_of: string;
  stale_price: boolean;
};

export type StatsData = {
  generated_at: string;
  as_of: string;
  universe: {
    n_reports: number;
    n_by_tier: Record<string, number>;
    base_rate_pct: number | null;
    success_def: string;
    criteria: string;
    skipped_no_price: number;
    coverage_caveat: string;
  };
  features: FeatureSummary[];
  tier_order: string[];
  tier_stats: Record<string, Record<string, TierStat>>;
  lift: Record<string, { n: number; bins: LiftBin[] }>;
  top_factors: TopFactor[];
  logit: {
    n: number;
    auc_in_sample: number | null;
    coefs: { key: string; label: string; coef: number | null }[];
    note: string;
  } | null;
  candidates: Candidate[];
  // v25: 학회 합의 — 발간 직전 90일 내 같은 종목을 커버한 학회 수별 성과
  consensus?: {
    window_days: number;
    base_rate_pct: number | null;
    n_reports: number;
    groups: {
      label: string;
      n: number;
      success_pct: number | null;
      lift: number | null;
      median_peak_pct: number | null;
      median_latest_pct: number | null;
    }[];
    episodes: {
      ticker: string;
      slug: string;
      name: string;
      report_date: string;
      school: string;
      n_schools: number;
      tier: string;
      peak_pct: number | null;
      latest_pct: number | null;
    }[];
    note: string;
  };
};

/** 피처 키 → 표 머리글용 짧은 라벨 */
export const FACTOR_SHORT_LABELS: Record<string, string> = {
  ret_1m: "1개월",
  ret_3m: "3개월",
  ret_6m: "6개월",
  ret_12m: "12개월",
  prox_52w_high: "52주고가",
  mult_52w_low: "52주저가",
  vol_60d: "변동성",
  vol_trend: "거래량",
  vs_ma200: "200일선",
  rs_6m: "상대강도",
  stated_upside_pct: "상승여력",
  n_clubs_18m: "학회수",
};
