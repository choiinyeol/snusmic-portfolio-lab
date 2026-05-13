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
    last_close_date: NullableString,
    current_return: NullableNumber,
    peak_return: NullableNumber,
    trough_return: NullableNumber,
    target_gap_pct: NullableNumber,
    expiry_date: NullableString,
    expired: Bool,
    caveat_flags: z.array(z.string()),
  })
  .passthrough();

export const RawHoldingRowSchema = z
  .object({
    persona: z.string(),
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
    persona: z.string(),
    date: z.string(),
    symbol: z.string(),
    side: z.string(),
    qty: NullableNumber,
    fill_price_krw: NullableNumber,
    gross_krw: NullableNumber,
    cash_after_krw: NullableNumber,
    reason: z.string(),
    report_id: NullableString,
  })
  .passthrough();

export const RawEquityPointSchema = z
  .object({
    persona: z.string(),
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
          persona: z.string(),
          equity_krw: z.array(NullableNumber),
          cumulative_return: z.array(NullableNumber),
        })
        .passthrough(),
    ),
  })
  .passthrough();

export const WebPersonaSchema = z
  .object({
    persona: z.string(),
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

export const WebOverviewSchema = z
  .object({
    generated_from: z.record(z.string(), z.string()).optional(),
    report_counts: z.record(z.string(), z.number()).optional(),
    target_stats: z.record(z.string(), NullableNumber).optional(),
    baseline_personas: z.array(WebPersonaSchema),
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

export const StrategyCatalogRowSchema = z
  .object({
    strategy_id: z.string(),
    label: z.string(),
    short_label: z.string(),
    kind: z.enum(['benchmark', 'strategy', 'oracle']),
    benchmark_group: z.string().nullable(),
    is_selectable: z.boolean(),
    is_default_candidate: z.boolean(),
    objective_passed: z.boolean(),
    objective_return_excess: NullableNumber,
    objective_mdd_slack: NullableNumber,
    methodology_summary: z.string(),
    buy_rules: z.array(z.string()),
    sell_rules: z.array(z.string()),
    risk_controls: z.array(z.string()),
    params: z.record(z.string(), z.unknown()),
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

export const ScreenerCandidateSchema = z
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
