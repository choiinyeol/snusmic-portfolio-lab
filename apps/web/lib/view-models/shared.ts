import type { ReportRow } from '@/lib/artifacts';

export type MetricTone = 'neutral' | 'positive' | 'negative' | 'warning' | 'data' | 'accent';

export type PageMetric = {
  id: string;
  label: string;
  value: string;
  helper?: string;
  tone: MetricTone;
};

export type DataWarning = {
  id: string;
  level: 'info' | 'warning' | 'error';
  message: string;
};

export type PageHeaderModel = {
  eyebrow?: string;
  title: string;
  meta?: string;
  description?: string;
  actions?: string[];
  badges?: Array<{ label: string; value?: string | number | null }>;
};

export type TableViewPreset = {
  id: string;
  label: string;
  count: number;
  description?: string;
};

export type ReportVerificationDisplayRow = {
  id: string;
  symbol: string;
  company: string;
  exchange: string;
  publicationDate: string;
  entryPrice: number | null;
  targetPrice: number | null;
  targetUpside: number | null;
  currentReturn: number | null;
  targetRemaining: number | null;
  targetProgress: number | null;
  peakReturn: number | null;
  troughReturn: number | null;
  status: 'hit' | 'open' | 'expired' | 'excluded' | 'warning';
  statusLabel: string;
  href: string;
};

export type ReportVerificationTableModel = {
  rows: ReportVerificationDisplayRow[];
  sourceRows: ReportRow[];
  defaultView: string;
  views: TableViewPreset[];
};

export function metricToneToKpiTone(tone: MetricTone): 'neutral' | 'good' | 'bad' | 'warn' | 'accent' {
  if (tone === 'positive') return 'good';
  if (tone === 'negative') return 'bad';
  if (tone === 'warning') return 'warn';
  if (tone === 'accent' || tone === 'data') return 'accent';
  return 'neutral';
}
