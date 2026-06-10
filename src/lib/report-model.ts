import { z } from "zod";
import raw from "@/data/report-performance.json";

const MarketSchema = z.enum(["KR", "US"]);
const DirectionSchema = z.enum(["up", "down", "flat"]);
const BucketSchema = z.enum(["Tenbagger", "Multibagger", "Double", "Winner", "Positive", "Drawdown", "Wrecked", "No quote"]);
const RatingClassSchema = z.enum(["buy", "soft_buy", "sell"]);
const MaturitySchema = z.enum(["fresh", "developing", "seasoned", "veteran"]);
const SchoolSchema = z.enum(["smic", "yig", "star", "kuvic"]);

export const SCHOOL_LABELS: Record<z.infer<typeof SchoolSchema>, string> = {
  smic: "서울대 SMIC",
  yig: "연세대 YIG",
  star: "성균관대 STAR",
  kuvic: "고려대 KUVIC",
};

const NullableNumber = z.number().finite().nullable();
const NullableString = z.string().nullable();

export const ReportRecordSchema = z.object({
  source_file: z.string(),
  source_name: z.string(),
  school: SchoolSchema.catch("smic"),
  report_type: z.enum(["company", "sector"]).catch("company"),
  qa_flags: NullableString.optional().default(null),
  report_date: NullableString,
  filename_date: NullableString,
  market: MarketSchema.nullable(),
  company: NullableString,
  ticker: NullableString,
  exchange: NullableString,
  rating: NullableString,
  target_price: NullableNumber,
  target_price_raw: NullableString,
  report_current_price: NullableNumber,
  report_current_price_raw: NullableString,
  stated_upside_pct: NullableNumber,
  first_trade_date: NullableString,
  start_close: NullableNumber,
  latest_trade_date: NullableString,
  latest_close: NullableNumber,
  return_latest_pct: NullableNumber,
  direction_latest: DirectionSchema.nullable(),
  return_30d_pct: NullableNumber,
  return_90d_pct: NullableNumber,
  return_180d_pct: NullableNumber,
  return_365d_pct: NullableNumber,
  return_ytd_pct: NullableNumber.optional().default(null),
  benchmark_return_pct: NullableNumber.optional().default(null),
  alpha_latest_pct: NullableNumber.optional().default(null),
  max_high_until_latest: NullableNumber,
  max_high_return_pct: NullableNumber,
  target_hit_until_latest: z.boolean().nullable(),
  first_target_hit_date: NullableString,
  days_to_target: z.number().int().nullable(),
  rating_class: RatingClassSchema.catch("soft_buy"),
  display_name: NullableString.optional().default(null),
  age_days: z.number().int().nullable().optional().default(null),
  maturity: MaturitySchema.nullable().optional().default(null),
  data_issue: NullableString,
  parse_issue: NullableString,
  performance_bucket: BucketSchema,
});

export const SummaryRecordSchema = z.object({
  group: z.string(),
  reports: z.number().int().nonnegative(),
  priced_reports: z.number().int().nonnegative(),
  with_target: z.number().int().nonnegative(),
  up_latest: z.number().int().nonnegative(),
  down_latest: z.number().int().nonnegative(),
  target_hit: z.number().int().nonnegative(),
  avg_return_latest_pct: NullableNumber,
  median_return_latest_pct: NullableNumber,
});

export const ReportDatasetSchema = z.object({
  generated_at: z.string(),
  as_of: z.string(),
  excluded_sector_count: z.number().int().nonnegative().default(0),
  records: z.array(ReportRecordSchema),
  summary: z.array(SummaryRecordSchema),
});

export type Market = z.infer<typeof MarketSchema>;
export type School = z.infer<typeof SchoolSchema>;
export type ReportRecord = z.infer<typeof ReportRecordSchema>;
export type SummaryRecord = z.infer<typeof SummaryRecordSchema>;
export type ReportDataset = z.infer<typeof ReportDatasetSchema>;
export type RatingClass = z.infer<typeof RatingClassSchema>;
export type Maturity = z.infer<typeof MaturitySchema>;

export type DataQuality = {
  valid: boolean;
  generatedAt: string | null;
  asOf: string | null;
  totalRecords: number;
  validRecords: number;
  validationIssueCount: number;
  dataIssueCount: number;
  parseIssueCount: number;
  missingQuoteCount: number;
  missingTargetCount: number;
  issueSummaries: string[];
};

function fallbackDataset(input: unknown): ReportDataset {
  const candidate = input as Partial<ReportDataset>;
  const records = Array.isArray(candidate.records)
    ? candidate.records.flatMap((record) => {
        const parsed = ReportRecordSchema.safeParse(record);
        return parsed.success ? [parsed.data] : [];
      })
    : [];
  const summary = Array.isArray(candidate.summary)
    ? candidate.summary.flatMap((item) => {
        const parsed = SummaryRecordSchema.safeParse(item);
        return parsed.success ? [parsed.data] : [];
      })
    : [];
  return {
    generated_at: typeof candidate.generated_at === "string" ? candidate.generated_at : "",
    as_of: typeof candidate.as_of === "string" ? candidate.as_of : "",
    excluded_sector_count: typeof candidate.excluded_sector_count === "number" ? candidate.excluded_sector_count : 0,
    records,
    summary,
  };
}

function summarizeZodIssue(issue: z.ZodIssue) {
  const path = issue.path.length ? issue.path.join(".") : "root";
  return `${path}: ${issue.message}`;
}

const parsedDataset = ReportDatasetSchema.safeParse(raw);

export const reportDataset: ReportDataset = parsedDataset.success ? parsedDataset.data : fallbackDataset(raw);

export const reportDataQuality: DataQuality = {
  valid: parsedDataset.success,
  generatedAt: reportDataset.generated_at || null,
  asOf: reportDataset.as_of || null,
  totalRecords: Array.isArray((raw as { records?: unknown }).records) ? ((raw as { records: unknown[] }).records.length) : 0,
  validRecords: reportDataset.records.length,
  validationIssueCount: parsedDataset.success ? 0 : parsedDataset.error.issues.length,
  dataIssueCount: reportDataset.records.filter((record) => record.data_issue).length,
  parseIssueCount: reportDataset.records.filter((record) => record.parse_issue).length,
  missingQuoteCount: reportDataset.records.filter((record) => record.latest_close === null || record.start_close === null).length,
  missingTargetCount: reportDataset.records.filter((record) => record.target_price === null).length,
  issueSummaries: parsedDataset.success ? [] : parsedDataset.error.issues.slice(0, 8).map(summarizeZodIssue),
};

export function getDisplayName(report: ReportRecord) {
  return report.display_name || report.company || report.ticker || report.source_name.replace(/\.md$/, "");
}

export function dateLabel(value: string | null) {
  if (!value) return "날짜 없음";
  return value.replaceAll("-", ".");
}
