import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd(), '../..');
const webRoot = path.join(repoRoot, 'data/web');
const required = [
  'manifest.json',
  'overview/snapshot.json',
  'overview/research-pulse.json',
  'overview/data-quality.json',
  'portfolio/accounts.json',
  'portfolio/holdings.json',
  'portfolio/trades.json',
  'portfolio/daily-decisions.json',
  'portfolio/equity-daily.json',
  'reports/table.json',
  'reports/rankings.json',
  'report-statistics-lab.json',
  'accounts/catalog.json',
  'accounts/curves.json',
  'screener/candidates.json',
];

function fail(message) {
  throw new Error(`[artifact-check] ${message}`);
}

function readJson(relativePath) {
  const full = path.join(webRoot, relativePath);
  if (!fs.existsSync(full)) fail(`missing required artifact: data/web/${relativePath}`);
  const text = fs.readFileSync(full, 'utf8');
  if (/\bNaN\b|\bInfinity\b|-Infinity\b/.test(text)) {
    fail(`non-JSON numeric sentinel found in data/web/${relativePath}`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    fail(`invalid JSON in data/web/${relativePath}: ${error.message}`);
  }
}

function rowCount(data) {
  if (Array.isArray(data)) return data.length;
  if (Array.isArray(data?.rows)) return data.rows.length;
  return 1;
}

for (const file of required) {
  if (!fs.existsSync(path.join(webRoot, file))) fail(`missing required artifact: data/web/${file}`);
}

const manifest = readJson('manifest.json');
if (manifest.schema_version !== '1.0.0') fail(`unsupported manifest schema_version: ${manifest.schema_version}`);
if (manifest.artifact_root !== 'data/web') fail(`unexpected artifact_root: ${manifest.artifact_root}`);
if (!manifest.report_range?.start || !manifest.report_range?.end) fail('manifest report_range is incomplete');
if (!manifest.price_range?.start || !manifest.price_range?.end) fail('manifest price_range is incomplete');
if (!manifest.simulation_range?.start || !manifest.simulation_range?.end) {
  fail('manifest simulation_range is incomplete');
}

const countFiles = {
  reports: 'reports/table.json',
  current_holdings: 'portfolio/holdings.json',
  trades: 'portfolio/trades.json',
  daily_decisions: 'portfolio/daily-decisions.json',
  equity_daily: 'portfolio/equity-daily.json',
  accounts: 'portfolio/accounts.json',
  account_catalog: 'accounts/catalog.json',
  screener_candidates: 'screener/candidates.json',
};

for (const [key, file] of Object.entries(countFiles)) {
  const expected = manifest.row_counts?.[key];
  if (typeof expected !== 'number') fail(`manifest row_counts.${key} is missing`);
  const actual = rowCount(readJson(file));
  if (actual !== expected) fail(`manifest row_counts.${key}=${expected}, actual ${actual} in ${file}`);
}

const dailyDecisions = readJson('portfolio/daily-decisions.json');
if (dailyDecisions.metadata?.run_mode) {
  if (!dailyDecisions.metadata?.checkpoint_date) {
    fail('portfolio/daily-decisions.json metadata.checkpoint_date is missing');
  }
  if (!dailyDecisions.metadata?.checkpoint_schema_version) {
    fail('portfolio/daily-decisions.json metadata.checkpoint_schema_version is missing');
  }
}

const reports = readJson('reports/table.json');
const reportIds = new Set();
const reportSymbols = new Set();
for (const [index, report] of reports.entries()) {
  if (!report.report_id) fail(`reports/table.json[${index}].report_id is missing`);
  if (reportIds.has(report.report_id)) fail(`duplicate report_id: ${report.report_id}`);
  reportIds.add(report.report_id);
  if (!report.symbol) fail(`reports/table.json[${index}].symbol is missing`);
  reportSymbols.add(report.symbol);
}

const priceDir = path.join(webRoot, 'prices');
const priceFiles = fs.existsSync(priceDir)
  ? fs
      .readdirSync(priceDir)
      .filter((file) => file.endsWith('.json'))
      .sort()
  : [];
if (priceFiles.length !== manifest.price_artifact_count) {
  fail(`manifest price_artifact_count=${manifest.price_artifact_count}, actual ${priceFiles.length}`);
}
for (const symbol of reportSymbols) {
  if (!fs.existsSync(path.join(priceDir, `${symbol}.json`))) {
    fail(`missing price artifact for report symbol: ${symbol}`);
  }
}
for (const artifact of manifest.artifacts ?? []) {
  if (artifact.includes('\\')) fail(`manifest artifact path is not POSIX: ${artifact}`);
  if (!fs.existsSync(path.join(webRoot, artifact))) fail(`manifest lists missing artifact: ${artifact}`);
  if (!manifest.checksums?.[artifact]) fail(`manifest checksum missing for artifact: ${artifact}`);
}

const accounts = readJson('portfolio/accounts.json');
const benchmarkCount = accounts.filter((row) =>
  [
    'all_weather',
    'smic_follower',
    'smic_follower_v2',
    'benchmark_kodex200',
    'benchmark_qqq',
    'benchmark_spy',
    'benchmark_gld',
  ].includes(row.account_id),
).length;
const customStrategyCount = accounts.filter(
  (row) =>
    !row.account_id.startsWith('benchmark_') &&
    !['all_weather', 'smic_follower', 'smic_follower_v2', 'weak_oracle'].includes(row.account_id),
).length;
if (benchmarkCount < 7) fail(`expected at least 7 benchmark accounts, got ${benchmarkCount}`);
if (customStrategyCount !== 0) fail(`unexpected custom strategy accounts: ${customStrategyCount}`);

console.log(
  `[artifact-check] ok schema=${manifest.schema_version} reports=${reports.length} benchmarks=${benchmarkCount} custom_strategies=${customStrategyCount} price_files=${manifest.price_artifact_count}`,
);
