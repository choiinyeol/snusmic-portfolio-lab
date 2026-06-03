import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd(), '../..');
const webRoot = process.env.SNUSMIC_WEB_ARTIFACT_ROOT
  ? path.resolve(process.env.SNUSMIC_WEB_ARTIFACT_ROOT)
  : path.join(repoRoot, 'data/web');
const required = [
  'manifest.json',
  'overview/snapshot.json',
  'overview/research-pulse.json',
  'overview/data-quality.json',
  'portfolio/accounts.json',
  'portfolio/holdings.json',
  'portfolio/trades.json',
  'portfolio/daily-decisions/index.json',
  'portfolio/equity/index.json',
  'reports/table.json',
  'reports/rankings.json',
  'report-statistics-lab.json',
  'accounts/catalog.json',
  'accounts/curves.json',
  'report-board/candidates.json',
  'pages/report-verification.json',
  'pages/report-board.json',
  'pages/report-statistics.json',
  'pages/portfolio-dashboard.json',
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

function readRepoJson(relativePath) {
  const full = path.join(repoRoot, relativePath);
  if (!fs.existsSync(full)) fail(`missing required source file: ${relativePath}`);
  try {
    return JSON.parse(fs.readFileSync(full, 'utf8'));
  } catch (error) {
    fail(`invalid JSON in ${relativePath}: ${error.message}`);
  }
}

function rowCount(data) {
  if (Array.isArray(data)) return data.length;
  if (Array.isArray(data?.rows)) return data.rows.length;
  return 1;
}

function countShardRows(indexPath) {
  const index = readJson(indexPath);
  if (!Array.isArray(index.accounts)) fail(`${indexPath} accounts must be an array`);
  let total = 0;
  for (const entry of index.accounts) {
    if (!entry?.account_id) fail(`${indexPath} has a shard without account_id`);
    if (!entry?.path) fail(`${indexPath} has a shard without path`);
    const shard = readJson(entry.path);
    const actual =
      Array.isArray(shard?.dates) && Array.isArray(shard?.series)
        ? shard.dates.length * shard.series.length
        : rowCount(shard);
    if (typeof entry.row_count === 'number' && entry.row_count !== actual) {
      fail(`${entry.path} row_count=${entry.row_count}, actual ${actual}`);
    }
    total += actual;
  }
  return total;
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
  accounts: 'portfolio/accounts.json',
  account_catalog: 'accounts/catalog.json',
  report_board_candidates: 'report-board/candidates.json',
};

for (const [key, file] of Object.entries(countFiles)) {
  const expected = manifest.row_counts?.[key];
  if (typeof expected !== 'number') fail(`manifest row_counts.${key} is missing`);
  const actual = rowCount(readJson(file));
  if (actual !== expected) fail(`manifest row_counts.${key}=${expected}, actual ${actual} in ${file}`);
}

const shardedCounts = {
  daily_decisions: countShardRows('portfolio/daily-decisions/index.json'),
  equity_daily: countShardRows('portfolio/equity/index.json'),
};
for (const [key, actual] of Object.entries(shardedCounts)) {
  const expected = manifest.row_counts?.[key];
  if (typeof expected !== 'number') fail(`manifest row_counts.${key} is missing`);
  if (actual !== expected) fail(`manifest row_counts.${key}=${expected}, actual ${actual}`);
}

const dailyDecisions = readJson('portfolio/daily-decisions/index.json');
if (dailyDecisions.metadata?.run_mode) {
  if (!dailyDecisions.metadata?.checkpoint_date) {
    fail('portfolio/daily-decisions/index.json metadata.checkpoint_date is missing');
  }
  if (!dailyDecisions.metadata?.checkpoint_schema_version) {
    fail('portfolio/daily-decisions/index.json metadata.checkpoint_schema_version is missing');
  }
}

const reports = readJson('reports/table.json');
const pageBundles = [
  'pages/report-verification.json',
  'pages/report-board.json',
  'pages/report-statistics.json',
  'pages/portfolio-dashboard.json',
];
for (const file of pageBundles) {
  const page = readJson(file);
  if (page.schema_version !== '1.0.0') fail(`${file} has invalid schema_version`);
  if (!page.as_of?.report_date || !page.as_of?.price_date) fail(`${file} has incomplete as_of`);
  if (!Array.isArray(page.metrics)) fail(`${file} metrics must be an array`);
}
const reportStatisticsPage = readJson('pages/report-statistics.json');
const statisticsSummary = reportStatisticsPage.summary;
if (!statisticsSummary || typeof statisticsSummary !== 'object') {
  fail('pages/report-statistics.json summary is missing');
}
if (!statisticsSummary.sample || typeof statisticsSummary.sample.reportCount !== 'number') {
  fail('pages/report-statistics.json summary.sample.reportCount is missing');
}
if (!Array.isArray(statisticsSummary.riskScatter)) {
  fail('pages/report-statistics.json summary.riskScatter must be an array');
}
if (statisticsSummary.riskScatter.length === 0) {
  fail('pages/report-statistics.json summary.riskScatter is empty');
}
for (const [index, row] of statisticsSummary.riskScatter.slice(0, 10).entries()) {
  if (!row.reportId) fail(`pages/report-statistics.json summary.riskScatter[${index}].reportId is missing`);
  if (!row.symbol) fail(`pages/report-statistics.json summary.riskScatter[${index}].symbol is missing`);
  if (!row.publicationDate) {
    fail(`pages/report-statistics.json summary.riskScatter[${index}].publicationDate is missing`);
  }
  for (const flag of ['hit06', 'hit08', 'hit10']) {
    if (typeof row[flag] !== 'boolean') {
      fail(`pages/report-statistics.json summary.riskScatter[${index}].${flag} must be boolean`);
    }
  }
}
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
const missingSymbols = new Set();
for (const [index, row] of readJson('missing-symbols.json').entries()) {
  if (!row?.symbol) fail(`missing-symbols.json[${index}].symbol is missing`);
  missingSymbols.add(row.symbol);
  if (!fs.existsSync(path.join(priceDir, `${row.symbol}.json`))) {
    fail(`missing-symbols entry lacks price artifact: ${row.symbol}`);
  }
}
if (manifest.data_quality?.missing_price_symbols !== missingSymbols.size) {
  fail(
    `manifest data_quality.missing_price_symbols=${manifest.data_quality?.missing_price_symbols}, actual ${missingSymbols.size}`,
  );
}
const krxSuffixesByRaw = new Map();
for (const file of priceFiles) {
  const artifact = readJson(`prices/${file}`);
  const symbol = file.replace(/\.json$/, '');
  if (artifact.symbol !== symbol) {
    fail(`price artifact symbol mismatch in prices/${file}: ${artifact.symbol}`);
  }
  if (artifact.missing_price === true && reportSymbols.has(symbol) && !missingSymbols.has(symbol)) {
    fail(`price artifact is marked missing_price without missing-symbols entry: ${symbol}`);
  }
  const match = /^(\d{6})\.(KS|KQ)$/.exec(symbol);
  if (match) {
    const raw = match[1];
    const suffixes = krxSuffixesByRaw.get(raw) ?? new Set();
    suffixes.add(match[2]);
    krxSuffixesByRaw.set(raw, suffixes);
  }
}
for (const [raw, suffixes] of krxSuffixesByRaw.entries()) {
  if (suffixes.has('KS') && suffixes.has('KQ')) {
    fail(`both KOSPI and KOSDAQ price artifacts exist for raw ticker: ${raw}.KS/.KQ`);
  }
}
for (const artifact of manifest.artifacts ?? []) {
  if (artifact.includes('\\')) fail(`manifest artifact path is not POSIX: ${artifact}`);
  if (!fs.existsSync(path.join(webRoot, artifact))) fail(`manifest lists missing artifact: ${artifact}`);
  if (!manifest.checksums?.[artifact]) fail(`manifest checksum missing for artifact: ${artifact}`);
}

const accounts = readJson('portfolio/accounts.json');
const accountConfig = readRepoJson('data/sim/account-configs.json');
const configuredAccountIds = (accountConfig.accounts ?? []).map((row) => row.account_id);
const expectedAccountIds = [
  'all_weather',
  'smic_follower',
  'smic_follower_v2',
  'pit_score_top3',
  'pit_score_top5',
  'pit_score_top10',
  'pit_momentum_top5',
  'pit_trend_top5',
  'pit_fresh_top5',
  'pit_trend_top7',
  'pit_trend_stop_top5',
  'pit_trend_stop_top7',
  'pit_trend_rotate_top5',
  'pit_trend_rotate_fast_top5',
  'pit_trend_rotate_stop_top5',
  'pit_trend_persist20_top5',
  'pit_trend_persist30_top5',
  'pit_trend_persist20_hold90_top5',
  'pit_trend_persist20_top3',
  'pit_trend_persist20_top7',
  'pit_trend_persist20_52w10_top5',
  'pit_trend_persist20_domestic_top5',
  'pit_trend_persist20_score_top5',
  'pit_trend_persist20_scorecap_top5',
  'pit_trend_persist20_invvol_top5',
  'pit_trend_persist20_invvolcap_top5',
  'pit_trend_persist20_semimonthly_top5',
  'pit_trend_persist20_quarterly_top5',
  'pit_trend_persist30_quarterly_top5',
  'pit_trend_persist20_quarterly_risk_top5',
  'pit_trend_persist30_quarterly_risk_top5',
  'pit_trend_persist20_quarterly_hold120_top5',
  'pit_trend_quarterly_ret3_top5',
  'pit_trend_quarterly_ret6_top5',
  'pit_trend_quarterly_ret36_top5',
  'pit_trend_quarterly_fresh365_top5',
  'pit_trend_quarterly_fresh540_top5',
  'pit_trend_persist20_fresh540_top5',
  'pit_trend_persist20_fresh540_top3',
  'pit_trend_persist20_fresh540_top7',
  'pit_trend_quarterly_fresh540_top3',
  'pit_trend_quarterly_fresh540_top7',
  'pit_trend_quarterly_fresh540_gross_top5',
  'pit_trend_quarterly_fresh540_slip25_top5',
  'pit_trend_quarterly_fresh540_slip50_top5',
  'pit_trend_quarterly_fresh540_feb_top5',
  'pit_trend_quarterly_fresh540_mar_top5',
  'pit_trend_quarterly_fresh540_cash90_top5',
  'pit_trend_quarterly_fresh540_cash80_top5',
  'pit_trend_quarterly_fresh540_vol35_top5',
  'pit_trend_quarterly_fresh540_vol40_top5',
  'pit_trend_quarterly_fresh540_vol45_top5',
  'pit_trend_quarterly_fresh540_vol50_top5',
  'pit_trend_quarterly_fresh540_vol55_top5',
  'pit_trend_quarterly_fresh540_mar_vol45_top5',
  'pit_trend_quarterly_fresh540_entry270_top5',
  'pit_trend_quarterly_fresh540_entry270_vol50_top5',
  'pit_trend_quarterly_fresh540_entry270_mar_top5',
  'pit_trend_quarterly_fresh540_entry365_top5',
  'pit_trend_quarterly_fresh540_entry450_top5',
  'pit_trend_quarterly_fresh540_entry365_vol50_top5',
  'pit_trend_quarterly_fresh540_rank15_top5',
  'pit_trend_quarterly_fresh540_rank25_top5',
  'pit_trend_quarterly_fresh540_runwinners_top5',
  'pit_trend_quarterly_fresh540_runwinners_vol50_top5',
  'pit_trend_quarterly_fresh540_runwinners_top3',
  'pit_trend_quarterly_fresh540_runwinners_top7',
  'pit_trend_quarterly_fresh540_runwinners_feb_top5',
  'pit_trend_quarterly_fresh540_runwinners_mar_top5',
  'pit_trend_quarterly_fresh540_runwinners_slip25_top5',
  'pit_trend_quarterly_fresh540_runwinners_slip50_top5',
  'pit_trend_quarterly_fresh540_runwinners_cap40_top5',
  'pit_trend_quarterly_fresh540_runwinners_cap35_top5',
  'pit_trend_quarterly_fresh540_runwinners_soft45_top5',
  'pit_trend_quarterly_fresh540_runwinners_vol50_cap40_top5',
  'pit_trend_quarterly_fresh540_runwinners_weeklycap45_top5',
  'pit_trend_quarterly_fresh540_runwinners_dailycap45_top5',
  'pit_trend_quarterly_fresh540_runwinners_vol50_weeklycap45_top5',
  'pit_trend_quarterly_fresh540_runwinners_weeklycap50_top5',
  'pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit10_top5',
  'pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit25_top5',
  'pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit40_top5',
  'pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit50_top5',
  'pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit50_slip25_top5',
  'pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit50_slip50_top5',
  'pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5',
  'pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top5',
  'pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top3',
  'pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top7',
  'pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_slip25_top5',
  'pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_slip50_top5',
  'pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_midcontrib_top5',
  'pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_lastcontrib_top5',
  'pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_momentum_top5',
  'pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_midcontrib_top5',
  'pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_lastcontrib_top5',
  'pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_slip25_top5',
  'pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_slip50_top5',
  'pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top3',
  'pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top7',
  'pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit75_top5',
  'pit_trend_quarterly_fresh540_runwinners_dailycap45_profit25_top5',
  'pit_trend_quarterly_fresh540_confirm5_top5',
  'pit_trend_quarterly_fresh540_confirm10_top5',
  'pit_trend_quarterly_fresh540_confirm10_vol50_top5',
  'pit_trend_persist20_kodex50_top5',
  'pit_trend_persist20_kodex200_top5',
  'benchmark_kodex200',
  'benchmark_qqq',
  'benchmark_spy',
  'benchmark_gld',
];
for (const id of configuredAccountIds) {
  if (!expectedAccountIds.includes(id)) expectedAccountIds.push(id);
}
const accountIds = accounts.map((row) => row.account_id);
const unexpectedAccountIds = accountIds.filter((id) => !expectedAccountIds.includes(id));
const missingAccountIds = expectedAccountIds.filter((id) => !accountIds.includes(id));
if (unexpectedAccountIds.length) fail(`unexpected account rows: ${unexpectedAccountIds.join(', ')}`);
if (missingAccountIds.length) fail(`missing account rows: ${missingAccountIds.join(', ')}`);
const expectedAccountKinds = new Map([
  ['all_weather', 'benchmark'],
  ['smic_follower', 'account'],
  ['smic_follower_v2', 'account'],
  ['pit_score_top3', 'account'],
  ['pit_score_top5', 'account'],
  ['pit_score_top10', 'account'],
  ['pit_momentum_top5', 'account'],
  ['pit_trend_top5', 'account'],
  ['pit_fresh_top5', 'account'],
  ['pit_trend_top7', 'account'],
  ['pit_trend_stop_top5', 'account'],
  ['pit_trend_stop_top7', 'account'],
  ['pit_trend_rotate_top5', 'account'],
  ['pit_trend_rotate_fast_top5', 'account'],
  ['pit_trend_rotate_stop_top5', 'account'],
  ['pit_trend_persist20_top5', 'account'],
  ['pit_trend_persist30_top5', 'account'],
  ['pit_trend_persist20_hold90_top5', 'account'],
  ['pit_trend_persist20_top3', 'account'],
  ['pit_trend_persist20_top7', 'account'],
  ['pit_trend_persist20_52w10_top5', 'account'],
  ['pit_trend_persist20_domestic_top5', 'account'],
  ['pit_trend_persist20_score_top5', 'account'],
  ['pit_trend_persist20_scorecap_top5', 'account'],
  ['pit_trend_persist20_invvol_top5', 'account'],
  ['pit_trend_persist20_invvolcap_top5', 'account'],
  ['pit_trend_persist20_semimonthly_top5', 'account'],
  ['pit_trend_persist20_quarterly_top5', 'account'],
  ['pit_trend_persist30_quarterly_top5', 'account'],
  ['pit_trend_persist20_quarterly_risk_top5', 'account'],
  ['pit_trend_persist30_quarterly_risk_top5', 'account'],
  ['pit_trend_persist20_quarterly_hold120_top5', 'account'],
  ['pit_trend_quarterly_ret3_top5', 'account'],
  ['pit_trend_quarterly_ret6_top5', 'account'],
  ['pit_trend_quarterly_ret36_top5', 'account'],
  ['pit_trend_quarterly_fresh365_top5', 'account'],
  ['pit_trend_quarterly_fresh540_top5', 'account'],
  ['pit_trend_persist20_fresh540_top5', 'account'],
  ['pit_trend_persist20_fresh540_top3', 'account'],
  ['pit_trend_persist20_fresh540_top7', 'account'],
  ['pit_trend_quarterly_fresh540_top3', 'account'],
  ['pit_trend_quarterly_fresh540_top7', 'account'],
  ['pit_trend_quarterly_fresh540_gross_top5', 'account'],
  ['pit_trend_quarterly_fresh540_slip25_top5', 'account'],
  ['pit_trend_quarterly_fresh540_slip50_top5', 'account'],
  ['pit_trend_quarterly_fresh540_feb_top5', 'account'],
  ['pit_trend_quarterly_fresh540_mar_top5', 'account'],
  ['pit_trend_quarterly_fresh540_cash90_top5', 'account'],
  ['pit_trend_quarterly_fresh540_cash80_top5', 'account'],
  ['pit_trend_quarterly_fresh540_vol35_top5', 'account'],
  ['pit_trend_quarterly_fresh540_vol40_top5', 'account'],
  ['pit_trend_quarterly_fresh540_vol45_top5', 'account'],
  ['pit_trend_quarterly_fresh540_vol50_top5', 'account'],
  ['pit_trend_quarterly_fresh540_vol55_top5', 'account'],
  ['pit_trend_quarterly_fresh540_mar_vol45_top5', 'account'],
  ['pit_trend_quarterly_fresh540_entry270_top5', 'account'],
  ['pit_trend_quarterly_fresh540_entry270_vol50_top5', 'account'],
  ['pit_trend_quarterly_fresh540_entry270_mar_top5', 'account'],
  ['pit_trend_quarterly_fresh540_entry365_top5', 'account'],
  ['pit_trend_quarterly_fresh540_entry450_top5', 'account'],
  ['pit_trend_quarterly_fresh540_entry365_vol50_top5', 'account'],
  ['pit_trend_quarterly_fresh540_rank15_top5', 'account'],
  ['pit_trend_quarterly_fresh540_rank25_top5', 'account'],
  ['pit_trend_quarterly_fresh540_runwinners_top5', 'account'],
  ['pit_trend_quarterly_fresh540_runwinners_vol50_top5', 'account'],
  ['pit_trend_quarterly_fresh540_runwinners_top3', 'account'],
  ['pit_trend_quarterly_fresh540_runwinners_top7', 'account'],
  ['pit_trend_quarterly_fresh540_runwinners_feb_top5', 'account'],
  ['pit_trend_quarterly_fresh540_runwinners_mar_top5', 'account'],
  ['pit_trend_quarterly_fresh540_runwinners_slip25_top5', 'account'],
  ['pit_trend_quarterly_fresh540_runwinners_slip50_top5', 'account'],
  ['pit_trend_quarterly_fresh540_runwinners_cap40_top5', 'account'],
  ['pit_trend_quarterly_fresh540_runwinners_cap35_top5', 'account'],
  ['pit_trend_quarterly_fresh540_runwinners_soft45_top5', 'account'],
  ['pit_trend_quarterly_fresh540_runwinners_vol50_cap40_top5', 'account'],
  ['pit_trend_quarterly_fresh540_runwinners_weeklycap45_top5', 'account'],
  ['pit_trend_quarterly_fresh540_runwinners_dailycap45_top5', 'account'],
  ['pit_trend_quarterly_fresh540_runwinners_vol50_weeklycap45_top5', 'account'],
  ['pit_trend_quarterly_fresh540_runwinners_weeklycap50_top5', 'account'],
  ['pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit10_top5', 'account'],
  ['pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit25_top5', 'account'],
  ['pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit40_top5', 'account'],
  ['pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit50_top5', 'account'],
  ['pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit50_slip25_top5', 'account'],
  ['pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit50_slip50_top5', 'account'],
  ['pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5', 'account'],
  ['pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top5', 'account'],
  ['pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top3', 'account'],
  ['pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top7', 'account'],
  ['pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_slip25_top5', 'account'],
  ['pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_slip50_top5', 'account'],
  ['pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_midcontrib_top5', 'account'],
  ['pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_lastcontrib_top5', 'account'],
  ['pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_momentum_top5', 'account'],
  ['pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_midcontrib_top5', 'account'],
  ['pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_lastcontrib_top5', 'account'],
  ['pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_slip25_top5', 'account'],
  ['pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_slip50_top5', 'account'],
  ['pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top3', 'account'],
  ['pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top7', 'account'],
  ['pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit75_top5', 'account'],
  ['pit_trend_quarterly_fresh540_runwinners_dailycap45_profit25_top5', 'account'],
  ['pit_trend_quarterly_fresh540_confirm5_top5', 'account'],
  ['pit_trend_quarterly_fresh540_confirm10_top5', 'account'],
  ['pit_trend_quarterly_fresh540_confirm10_vol50_top5', 'account'],
  ['pit_trend_persist20_kodex50_top5', 'account'],
  ['pit_trend_persist20_kodex200_top5', 'account'],
  ['benchmark_kodex200', 'benchmark'],
  ['benchmark_qqq', 'benchmark'],
  ['benchmark_spy', 'benchmark'],
  ['benchmark_gld', 'benchmark'],
]);
for (const id of configuredAccountIds) {
  if (!expectedAccountKinds.has(id)) {
    expectedAccountKinds.set(id, id === 'all_weather' || id.startsWith('benchmark_') ? 'benchmark' : 'account');
  }
}
for (const row of accounts) {
  const expectedKind = expectedAccountKinds.get(row.account_id);
  if (row.kind !== expectedKind) {
    fail(`account ${row.account_id} has kind=${row.kind}, expected ${expectedKind}`);
  }
}

console.log(
  `[artifact-check] ok schema=${manifest.schema_version} reports=${reports.length} accounts=${accountIds.length} price_files=${manifest.price_artifact_count}`,
);
