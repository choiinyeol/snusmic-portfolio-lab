import 'server-only';
import { z } from 'zod';

/** Raw shapes of the JSON artifacts emitted by `snusmic_pipeline.web_artifacts`.
 *
 * The web app's typed view models live in `lib/artifacts.ts`; these schemas
 * sit at the data boundary so any drift between the Python exporter and the
 * TypeScript reader is caught at build time with a clear path-aware error
 * instead of silently coalescing to `null`.
 *
 * Numeric fields use `z.number().nullable()` because the exporter writes
 * `null` for missing values rather than `NaN` or omitted keys. Schemas only
 * cover fields the app actually reads — extra columns are tolerated.
 */

const NullableNumber = z.number().nullable();
const NullableString = z.string().nullable();
const Bool = z.boolean();

export const RawReportRowSchema = z
  .object({
    report_id: z.string(),
    symbol: z.string(),
    company: z.string(),
    date: z.string(),
    title: z.string().optional(),
    exchange: z.string().optional(),
    markdown_filename: z.string().optional(),
    pdf_url: z.string().optional(),
    currency: z.string(),
    display_currency: z.string(),
    target_direction: z.enum(['upside', 'downside']).nullable(),
    entry_price_krw: NullableNumber,
    entry_price_native: NullableNumber,
    target_price_krw: NullableNumber,
    target_price_native: NullableNumber,
    target_upside_at_pub: NullableNumber,
    target_hit: Bool,
    target_hit_date: NullableString,
    days_to_target: NullableNumber,
    last_close_krw: NullableNumber,
    last_close_native: NullableNumber,
    last_close_date: NullableString,
    current_return: NullableNumber,
    peak_return: NullableNumber,
    trough_return: NullableNumber,
    target_gap_pct: NullableNumber,
    evaluation_close_krw: NullableNumber.optional(),
    evaluation_close_date: NullableString.optional(),
    evaluation_return: NullableNumber.optional(),
    target_remaining_pct: NullableNumber,
    target_progress_pct: NullableNumber,
    expiry_date: NullableString,
    expired: Bool,
    caveat_flags: z.array(z.string()),
  })
  .passthrough();

export const RawHoldingRowSchema = z
  .object({
    account_id: z.string(),
    symbol: z.string(),
    company: z.string(),
    qty: NullableNumber,
    avg_cost_krw: NullableNumber,
    last_close_krw: NullableNumber,
    last_close_native: NullableNumber,
    currency: z.string().optional(),
    market_value_krw: NullableNumber,
    unrealized_pnl_krw: NullableNumber,
    unrealized_return: NullableNumber,
    holding_days: NullableNumber,
    first_buy_date: NullableString,
  })
  .passthrough();

export const RawTradeRowSchema = z
  .object({
    account_id: z.string(),
    date: z.string(),
    symbol: z.string(),
    company: z.string(),
    side: z.string(),
    qty: NullableNumber,
    fill_price_krw: NullableNumber,
    gross_krw: NullableNumber,
    realized_pnl_krw: NullableNumber,
    cash_after_krw: NullableNumber,
    reason: z.string(),
    reason_detail: z.string().optional().nullable(),
    report_id: NullableString,
  })
  .passthrough();

export const RawEquityPointSchema = z
  .object({
    account_id: z.string(),
    date: z.string(),
    equity_krw: NullableNumber,
    contributed_capital_krw: NullableNumber,
  })
  .passthrough();

export const CompactTableArtifactSchema = z
  .object({
    columns: z.array(z.string()),
    rows: z.array(z.array(z.unknown())),
  })
  .passthrough();

export const CompactEquityArtifactSchema = z
  .object({
    dates: z.array(z.string()),
    series: z.array(
      z
        .object({
          account_id: z.string(),
          equity_krw: z.array(NullableNumber),
          cumulative_return: z.array(NullableNumber),
        })
        .passthrough(),
    ),
  })
  .passthrough();

export const PortfolioShardIndexSchema = z
  .object({
    schema_version: z.literal('1.0.0'),
    metadata: z.record(z.string(), z.unknown()).optional(),
    accounts: z.array(
      z
        .object({
          account_id: z.string(),
          path: z.string(),
          row_count: z.number().optional(),
        })
        .passthrough(),
    ),
  })
  .passthrough();

export const WebAccountSchema = z
  .object({
    account_id: z.string(),
    label: z.string().optional(),
    final_equity_krw: NullableNumber,
    final_cash_krw: NullableNumber.optional(),
    final_holdings_value_krw: NullableNumber.optional(),
    total_contributed_krw: NullableNumber.optional(),
    cumulative_deposits_krw: NullableNumber.optional(),
    net_profit_krw: NullableNumber,
    money_weighted_return: NullableNumber.optional(),
    cagr: NullableNumber.optional(),
    max_drawdown: NullableNumber,
    trade_count: NullableNumber,
    open_positions: NullableNumber.optional(),
  })
  .passthrough();

export const AccountingReconciliationRowSchema = z
  .object({
    account_id: z.string(),
    label: z.string().optional(),
    total_contributed_krw: NullableNumber,
    realized_pnl_krw: NullableNumber,
    final_cash_krw: NullableNumber,
    open_cost_basis_krw: NullableNumber,
    open_market_value_krw: NullableNumber,
    unrealized_pnl_krw: NullableNumber,
    cash_yield_krw: NullableNumber.optional(),
    final_equity_krw: NullableNumber,
    net_profit_krw: NullableNumber,
    expected_cash_krw: NullableNumber,
    cash_gap_krw: NullableNumber,
    equity_gap_krw: NullableNumber,
    profit_gap_krw: NullableNumber,
    status: z.enum(['ok', 'warning']),
    explanation_ko: z.string(),
  })
  .passthrough();

const WebReportCountsSchema = z
  .object({
    extracted_reports: z.number().optional(),
    web_report_rows: z.number().optional(),
    price_matched_reports: z.number().optional(),
    excluded_reports: z.number().optional(),
    excluded_missing_price: z.number().optional(),
    excluded_missing_performance: z.number().optional(),
    excluded_sell_opinion: z.number().optional(),
    excluded_non_positive_upside: z.number().optional(),
    excluded_downside_target: z.number().optional(),
    excluded_instant_target_hit: z.number().optional(),
  })
  .catchall(z.number());

export const WebOverviewSchema = z
  .object({
    generated_from: z.record(z.string(), z.string()).optional(),
    report_counts: WebReportCountsSchema.optional(),
    target_stats: z.record(z.string(), NullableNumber).optional(),
    baseline_accounts: z.array(WebAccountSchema),
    simulation_window: z.record(z.string(), z.union([z.string(), z.null()])).optional(),
  })
  .passthrough();

export const WebDataQualitySchema = z
  .object({
    coverage: z.record(z.string(), z.number()).optional(),
    extraction_quality: z.record(z.string(), z.unknown()).optional(),
    report_exclusions: z.record(z.string(), z.number()).optional(),
    missing_symbols: z
      .array(
        z
          .object({
            symbol: z.string(),
            company: z.string().optional(),
            reason: z.string().optional(),
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();

export const AccountCatalogRowSchema = z
  .object({
    account_id: z.string(),
    label: z.string(),
    short_label: z.string(),
    kind: z.enum(['benchmark', 'account', 'oracle']),
    benchmark_group: z.string().nullable(),
    is_selectable: z.boolean(),
    is_default_candidate: z.boolean(),
    objective_passed: z.boolean(),
    objective_return_excess: NullableNumber,
    objective_mdd_slack: NullableNumber,
    metrics: z
      .object({
        final_equity_krw: NullableNumber,
        final_cash_krw: NullableNumber,
        final_holdings_value_krw: NullableNumber,
        money_weighted_return: NullableNumber,
        cagr: NullableNumber,
        max_drawdown: NullableNumber,
        trade_count: NullableNumber,
        open_positions: NullableNumber,
      })
      .passthrough(),
  })
  .passthrough();

export const ReportBoardCandidateSchema = z
  .object({
    report_id: z.string(),
    symbol: z.string(),
    company: z.string(),
    date: z.string(),
    bucket: z.enum(['fresh', 'large-upside', 'near-target', 'active']),
    rank_basis: z.string(),
    score: z.number(),
    target_upside_at_pub: NullableNumber,
    current_return: NullableNumber,
    target_gap_pct: NullableNumber,
  })
  .passthrough();

const PageMetricSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    value: z.union([z.number(), z.string(), z.boolean(), z.null()]),
    tone: z.enum(['neutral', 'positive', 'negative', 'warning', 'accent']).optional(),
    helper: z.string().nullable().optional(),
  })
  .passthrough();

const PageAsOfSchema = z
  .object({
    report_date: NullableString,
    price_date: NullableString,
  })
  .passthrough();

const PageWarningSchema = z
  .object({
    level: z.enum(['info', 'warning', 'error']),
    message: z.string(),
  })
  .passthrough();

const ReportStatisticsSampleSchema = z
  .object({
    reportCount: z.number(),
    eligibleReportCount: z.number(),
    tickerCount: z.number(),
    startDate: z.string(),
    endDate: z.string(),
    exclusions: z.record(z.string(), z.number()),
  })
  .passthrough();

const ReportStatisticsRiskScatterSchema = z
  .object({
    reportId: z.string(),
    symbol: z.string(),
    company: z.string(),
    publicationDate: z.string(),
    maxFavorableExcursion: NullableNumber,
    maxAdverseExcursion: NullableNumber,
    upsideCaptureRatio: NullableNumber,
    targetReturn: NullableNumber,
    currentReturn: NullableNumber,
    expiryReturn: NullableNumber.optional(),
    expiryCloseKrw: NullableNumber.optional(),
    expiryDate: NullableString.optional(),
    hit06: z.boolean(),
    hit08: z.boolean(),
    hit10: z.boolean(),
  })
  .passthrough();

const ReportStatisticsHitWithinSchema = z
  .object({
    '30': z.boolean(),
    '60': z.boolean(),
    '120': z.boolean(),
    '250': z.boolean(),
  })
  .passthrough();

const ReportStatisticsHitSchema = z
  .object({
    hit: z.boolean(),
    days: NullableNumber,
    within: ReportStatisticsHitWithinSchema,
  })
  .passthrough();

const ReportStatisticsExampleSchema = z
  .object({
    reportId: z.string(),
    symbol: z.string(),
    company: z.string(),
    publicationDate: z.string(),
    entryPrice: NullableNumber,
    targetPrice: NullableNumber,
    targetReturn: NullableNumber,
    currentReturn: NullableNumber,
    maxFavorableExcursion: NullableNumber,
    maxAdverseExcursion: NullableNumber,
    upsideCaptureRatio: NullableNumber,
    hit: z
      .object({
        '0.6': ReportStatisticsHitSchema.optional(),
        '0.8': ReportStatisticsHitSchema.optional(),
        '1': ReportStatisticsHitSchema.optional(),
      })
      .passthrough(),
  })
  .passthrough();

export const ReportStatisticsLabSummarySchema = z
  .object({
    generatedAt: z.string(),
    sample: ReportStatisticsSampleSchema,
    fractionalHitRates: z.array(z.record(z.string(), z.unknown())),
    delayedEntry: z.array(z.record(z.string(), z.unknown())),
    entryTriggers: z.array(z.record(z.string(), z.unknown())),
    postTargetDrift: z.array(z.record(z.string(), z.unknown())),
    optimalTargetMultiples: z.array(z.record(z.string(), z.unknown())),
    riskScatter: z.array(ReportStatisticsRiskScatterSchema),
    topExamples: z.record(z.string(), z.array(ReportStatisticsExampleSchema)),
  })
  .passthrough();

export const ReportVerificationPageBundleSchema = z
  .object({
    schema_version: z.literal('1.0.0'),
    generated_at: NullableString,
    as_of: PageAsOfSchema,
    title: z.string(),
    metrics: z.array(PageMetricSchema),
    views: z.array(
      z
        .object({
          id: z.string(),
          label: z.string(),
          count: z.number().nullable(),
        })
        .passthrough(),
    ),
    warnings: z.array(PageWarningSchema),
    table: z.object({ rows: z.array(RawReportRowSchema) }).passthrough(),
  })
  .passthrough();

export const ReportBoardPageBundleSchema = z
  .object({
    schema_version: z.literal('1.0.0'),
    generated_at: NullableString,
    as_of: PageAsOfSchema,
    title: z.string(),
    metrics: z.array(PageMetricSchema),
    priority: z.array(ReportBoardCandidateSchema),
    table: z.object({ rows: z.array(ReportBoardCandidateSchema) }).passthrough(),
  })
  .passthrough();

export const ReportStatisticsPageBundleSchema = z
  .object({
    schema_version: z.literal('1.0.0'),
    generated_at: NullableString,
    as_of: PageAsOfSchema,
    title: z.string(),
    metrics: z.array(PageMetricSchema),
    summary: ReportStatisticsLabSummarySchema,
    rankings: z.record(z.string(), z.unknown()),
    target_distribution: z.record(z.string(), z.unknown()),
    return_windows: z.array(z.record(z.string(), z.unknown())),
  })
  .passthrough();

const ResearchCalendarDateSummarySchema = z
  .object({
    date: z.string(),
    candidate_count: z.number(),
    fresh_count: z.number(),
    target_hit_count: z.number(),
    momentum_count: z.number(),
    near_high_count: z.number(),
    forward_positive_63d_count: z.number(),
    forward_positive_63d_sample: z.number(),
    median_forward_return_63d: NullableNumber,
    forward_positive_500d_count: z.number(),
    forward_positive_500d_sample: z.number(),
    median_forward_return_500d: NullableNumber,
    forward_positive_latest_count: z.number(),
    forward_positive_latest_sample: z.number(),
    median_forward_return_latest: NullableNumber,
    forward_observed_sample: z.number(),
    max_forward_observed_days: z.number(),
    top_symbols: z.array(
      z
        .object({
          symbol: z.string(),
          company: z.string(),
          score: NullableNumber,
        })
        .passthrough(),
    ),
  })
  .passthrough();

export const ResearchCalendarArtifactSchema = z
  .object({
    schema_version: z.literal('1.0.0'),
    generated_at: NullableString,
    as_of: PageAsOfSchema,
    date_range: z.object({ start: z.string(), end: z.string() }).passthrough(),
    summary: z
      .object({
        date_count: z.number(),
        row_count: z.number(),
        symbol_count: z.number(),
        latest_date: z.string(),
      })
      .passthrough(),
    date_summaries: z.array(ResearchCalendarDateSummarySchema),
    table: CompactTableArtifactSchema,
  })
  .passthrough();

export const ArtifactManifestSchema = z
  .object({
    schema_version: z.string(),
    generated_at: z.string().nullable(),
    artifact_root: z.string(),
    report_range: z.object({ start: NullableString, end: NullableString }),
    price_range: z.object({ start: NullableString, end: NullableString }),
    simulation_range: z.object({ start: NullableString, end: NullableString }),
    row_counts: z.record(z.string(), z.number()),
    data_quality: z
      .object({
        total_reports: NullableNumber.optional(),
        reports_with_prices: NullableNumber.optional(),
        missing_price_symbols: NullableNumber.optional(),
        target_hit_count: NullableNumber.optional(),
      })
      .passthrough(),
    artifacts: z.array(z.string()),
    price_artifact_count: z.number(),
    checksums: z.record(z.string(), z.string()),
  })
  .passthrough();

export const ArtifactHealthSchema = z
  .object({
    schema_version: z.literal('1.0.0'),
    generated_at: NullableString,
    status: z.enum(['ok', 'review']),
    as_of: z.object({
      report_date: NullableString,
      price_date: NullableString,
      simulation_date: NullableString,
    }),
    checks: z.array(
      z
        .object({
          id: z.string(),
          label: z.string(),
          status: z.enum(['ok', 'review']),
          detail: z.string(),
          count: z.number().optional(),
        })
        .passthrough(),
    ),
  })
  .passthrough();

/** Parse a JSON array against a zod schema and throw a build-time-friendly
 * error when validation fails. The error names the file and the row index +
 * field path so a Python-side schema drift is unambiguous in CI logs. */
export function parseRows<T>(label: string, schema: z.ZodType<T>, raw: unknown): T[] {
  if (!Array.isArray(raw)) {
    throw new Error(`Schema mismatch in ${label}: expected an array at the top level, got ${typeof raw}.`);
  }
  return raw.map((row, index) => {
    const result = schema.safeParse(row);
    if (!result.success) {
      const issue = result.error.issues[0];
      const path = issue?.path.join('.') || '<root>';
      throw new Error(
        `Schema mismatch in ${label}[${index}].${path}: ${issue?.message ?? 'unknown'} ` +
          `(code: ${issue?.code ?? 'unknown'}). Re-run \`uv run python -m snusmic_pipeline export-web …\` ` +
          `or update lib/schemas.ts to match the new exporter contract.`,
      );
    }
    return result.data;
  });
}

export function parseArtifact<T>(label: string, schema: z.ZodType<T>, raw: unknown): T {
  const result = schema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path.join('.') || '<root>';
    throw new Error(
      `Schema mismatch in ${label}.${path}: ${issue?.message ?? 'unknown'} ` +
        `(code: ${issue?.code ?? 'unknown'}). Rebuild data/web or update lib/schemas.ts to match the artifact contract.`,
    );
  }
  return result.data;
}
