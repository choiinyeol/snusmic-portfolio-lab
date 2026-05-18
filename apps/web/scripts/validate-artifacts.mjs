import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd(), '../..');
const webRoot = path.join(repoRoot, 'data/web');
const required = [
  'manifest.json',
  'overview/snapshot.json',
  'overview/research-pulse.json',
  'overview/data-quality.json',
  'portfolio/personas.json',
  'portfolio/holdings.json',
  'portfolio/trades.json',
  'portfolio/equity-daily.json',
  'reports/table.json',
  'reports/rankings.json',
  'report-statistics-lab.json',
  'strategies/catalog.json',
  'strategies/admission.json',
  'strategies/curves.json',
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
  equity_daily: 'portfolio/equity-daily.json',
  personas: 'portfolio/personas.json',
  strategy_catalog: 'strategies/catalog.json',
  screener_candidates: 'screener/candidates.json',
};

for (const [key, file] of Object.entries(countFiles)) {
  const expected = manifest.row_counts?.[key];
  if (typeof expected !== 'number') fail(`manifest row_counts.${key} is missing`);
  const actual = rowCount(readJson(file));
  if (actual !== expected) fail(`manifest row_counts.${key}=${expected}, actual ${actual} in ${file}`);
}

const reports = readJson('reports/table.json');
const reportIds = new Set();
for (const [index, report] of reports.entries()) {
  if (!report.report_id) fail(`reports/table.json[${index}].report_id is missing`);
  if (reportIds.has(report.report_id)) fail(`duplicate report_id: ${report.report_id}`);
  reportIds.add(report.report_id);
  if (!report.symbol) fail(`reports/table.json[${index}].symbol is missing`);
}

const personas = readJson('portfolio/personas.json');
const benchmarkCount = personas.filter((row) =>
  [
    'all_weather',
    'smic_follower',
    'smic_follower_v2',
    'benchmark_kodex200',
    'benchmark_qqq',
    'benchmark_spy',
    'benchmark_gld',
    'weak_oracle',
  ].includes(row.persona),
).length;
const customStrategyCount = personas.filter(
  (row) =>
    !row.persona.startsWith('benchmark_') &&
    !['all_weather', 'smic_follower', 'smic_follower_v2', 'weak_oracle'].includes(row.persona),
).length;
if (benchmarkCount < 8) fail(`expected at least 8 benchmark personas, got ${benchmarkCount}`);
if (customStrategyCount < 1) fail('expected at least one custom strategy persona');

console.log(
  `[artifact-check] ok schema=${manifest.schema_version} reports=${reports.length} benchmarks=${benchmarkCount} strategies=${customStrategyCount} price_files=${manifest.price_artifact_count}`,
);
