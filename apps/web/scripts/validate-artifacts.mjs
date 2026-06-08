import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd(), '../..');
const webRoot = process.env.SNUSMIC_WEB_ARTIFACT_ROOT
  ? path.resolve(process.env.SNUSMIC_WEB_ARTIFACT_ROOT)
  : path.join(repoRoot, 'data/web');
const maxPriceAgeDays = Number(process.env.SNUSMIC_MAX_PRICE_AGE_DAYS ?? '7');
const maxReportAgeDays = Number(process.env.SNUSMIC_MAX_REPORT_AGE_DAYS ?? '30');
const externalCacheRoot = path.resolve(
  repoRoot,
  process.env.SNUSMIC_EXTERNAL_ARTIFACT_CACHE_DIR ?? '.cache/external-web-artifacts',
);
const required = [
  'manifest.json',
  'health.json',
  'report-health.json',
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

let manifestCache = null;

function manifestRelativePath(relativePath) {
  return relativePath.startsWith('data/web/') ? relativePath.slice('data/web/'.length) : relativePath;
}

function getManifest() {
  if (manifestCache) return manifestCache;
  const manifestPath = path.join(webRoot, 'manifest.json');
  const text = fs.readFileSync(manifestPath, 'utf8');
  manifestCache = JSON.parse(text);
  return manifestCache;
}

function resolveJsonPath(relativePath) {
  const full = path.join(webRoot, relativePath);
  if (fs.existsSync(full)) return full;
  const manifest = getManifest();
  const entry = manifest.external_artifacts?.[manifestRelativePath(relativePath)];
  if (!entry) fail(`missing required artifact: data/web/${relativePath}`);
  const cached = path.join(externalCacheRoot, manifestRelativePath(relativePath));
  if (!fs.existsSync(cached))
    fail(`external artifact cache missing for ${relativePath}; run hydrate:external-artifacts first`);
  return cached;
}

function readJson(relativePath) {
  const full = resolveJsonPath(relativePath);
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
function reportIdentityMap(rows, source) {
  if (!Array.isArray(rows)) fail(`${source} must be a report row array`);
  const identities = new Map();
  for (const [index, row] of rows.entries()) {
    if (!row || typeof row !== 'object') fail(`${source}[${index}] must be an object`);
    if (!row.report_id) fail(`${source}[${index}].report_id is missing`);
    if (!row.symbol) fail(`${source}[${index}].symbol is missing`);
    if (identities.has(row.report_id)) fail(`${source} contains duplicate report_id: ${row.report_id}`);
    identities.set(row.report_id, row.symbol);
  }
  return identities;
}

function parseCsvLine(line) {
  const cells = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const next = line[index + 1];
    if (character === '"') {
      if (quoted && next === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      cells.push(cell);
      cell = '';
    } else {
      cell += character;
    }
  }
  cells.push(cell);
  return cells;
}

function parseReportDownloadCsv(text) {
  const [headerLine, ...lines] = text.trimEnd().split(/\r?\n/);
  const headers = parseCsvLine(headerLine);
  const reportIdIndex = headers.indexOf('report_id');
  const symbolIndex = headers.indexOf('symbol');
  if (reportIdIndex === -1) fail('table-download-reports.csv report_id column is missing');
  if (symbolIndex === -1) fail('table-download-reports.csv symbol column is missing');
  return lines
    .filter((line) => line.length > 0)
    .map((line) => {
      const cells = parseCsvLine(line);
      return {
        report_id: cells[reportIdIndex],
        symbol: cells[symbolIndex],
      };
    });
}

function assertReportIdentitiesMatch(source, expected, actual) {
  const missing = [];
  const stale = [];
  const symbolMismatches = [];
  for (const [reportId, symbol] of expected.entries()) {
    if (!actual.has(reportId)) missing.push(reportId);
    else if (actual.get(reportId) !== symbol) symbolMismatches.push(reportId);
  }
  for (const reportId of actual.keys()) {
    if (!expected.has(reportId)) stale.push(reportId);
  }
  if (missing.length || stale.length || symbolMismatches.length) {
    fail(
      `${source} report cross-reference mismatch: missing_report_ids=${missing
        .slice(0, 10)
        .join(',')}, stale_report_ids=${stale.slice(0, 10).join(',')}, symbol_mismatches=${symbolMismatches
        .slice(0, 10)
        .join(',')}`,
    );
  }
}

function ageDays(dateText) {
  const parsed = Date.parse(`${dateText}T00:00:00Z`);
  if (!Number.isFinite(parsed)) return Number.POSITIVE_INFINITY;
  return Math.floor((Date.now() - parsed) / 86_400_000);
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
const externalArtifacts = manifest.external_artifacts ?? {};
for (const [artifact, pointer] of Object.entries(externalArtifacts)) {
  if (artifact.includes('\\')) fail(`external artifact path is not POSIX: ${artifact}`);
  if (!pointer || typeof pointer !== 'object') fail(`external artifact pointer is invalid: ${artifact}`);
  if (!pointer.checksum || typeof pointer.checksum !== 'string')
    fail(`external artifact checksum missing: ${artifact}`);
  if (!Number.isFinite(pointer.size_bytes) || pointer.size_bytes <= 0)
    fail(`external artifact size is invalid: ${artifact}`);
  if (!pointer.public_url || typeof pointer.public_url !== 'string')
    fail(`external artifact public_url missing: ${artifact}`);
}
if (manifest.artifact_root !== 'data/web') fail(`unexpected artifact_root: ${manifest.artifact_root}`);
if (!manifest.report_range?.start || !manifest.report_range?.end) fail('manifest report_range is incomplete');
if (!manifest.price_range?.start || !manifest.price_range?.end) fail('manifest price_range is incomplete');
if (!manifest.simulation_range?.start || !manifest.simulation_range?.end) {
  fail('manifest simulation_range is incomplete');
}
const health = readJson('health.json');
if (health.schema_version !== '1.0.0') fail(`health.json has invalid schema_version: ${health.schema_version}`);
const allowedHealthStatuses = ['ok', 'review', 'stale', 'fail'];
if (!allowedHealthStatuses.includes(health.status)) fail(`health.json has invalid status: ${health.status}`);
if (health.as_of?.report_date !== manifest.report_range.end) {
  fail(`health report_date=${health.as_of?.report_date}, manifest report_range.end=${manifest.report_range.end}`);
}
if (health.as_of?.price_date !== manifest.price_range.end) {
  fail(`health price_date=${health.as_of?.price_date}, manifest price_range.end=${manifest.price_range.end}`);
}
if (health.as_of?.simulation_date !== manifest.simulation_range.end) {
  fail(
    `health simulation_date=${health.as_of?.simulation_date}, manifest simulation_range.end=${manifest.simulation_range.end}`,
  );
}
if (!Array.isArray(health.checks) || health.checks.length === 0) {
  fail('health.json checks must be a non-empty array');
}
for (const [index, check] of health.checks.entries()) {
  if (!check?.id) fail(`health.json checks[${index}].id is missing`);
  if (!allowedHealthStatuses.includes(check.status)) fail(`health.json checks[${index}].status is invalid`);
  if (!allowedHealthStatuses.includes(check.severity)) fail(`health.json checks[${index}].severity is invalid`);
  if (check.severity === 'stale' || check.severity === 'fail') {
    fail(`health.json check ${check.id} is ${check.severity}: ${check.action ?? check.detail ?? 'no action'}`);
  }
}
const priceAgeDays = ageDays(manifest.price_range.end);
if (priceAgeDays > maxPriceAgeDays) {
  fail(`manifest price_range.end is stale: age_days=${priceAgeDays}, max=${maxPriceAgeDays}`);
}
const reportAgeDays = ageDays(manifest.report_range.end);
if (reportAgeDays > maxReportAgeDays) {
  fail(`manifest report_range.end is stale: age_days=${reportAgeDays}, max=${maxReportAgeDays}`);
}
const reportHealth = readJson('report-health.json');
if (reportHealth.schema_version !== '1.0.0') {
  fail(`report-health.json has invalid schema_version: ${reportHealth.schema_version}`);
}
if (!reportHealth.summary || typeof reportHealth.summary !== 'object') {
  fail('report-health.json summary is missing');
}
if (!Array.isArray(reportHealth.rows) || reportHealth.rows.length !== reportHealth.summary.source_reports) {
  fail(`report-health.json rows=${reportHealth.rows?.length}, source_reports=${reportHealth.summary?.source_reports}`);
}
const validReportWebStatuses = new Set(['visible', 'excluded']);
const validReportExtractionStatuses = new Set([
  'ok',
  'needs_review',
  'text_extract_failed',
  'missing_pdf_url',
  'download_failed',
  'not_pdf',
]);
const validReportExclusionReasons = new Set([
  'downside_target',
  'instant_target_hit',
  'missing_performance',
  'missing_price',
  'non_positive_upside',
  'sell_opinion',
]);
for (const [index, row] of reportHealth.rows.entries()) {
  if (!row?.report_id) fail(`report-health.json rows[${index}].report_id is missing`);
  if (!validReportWebStatuses.has(row.web_status)) {
    fail(`report-health.json rows[${index}].web_status is invalid: ${row.web_status}`);
  }
  if (!validReportExtractionStatuses.has(row.extraction_status)) {
    fail(`report-health.json rows[${index}].extraction_status is invalid: ${row.extraction_status}`);
  }
  if (row.web_exclusion_reason !== null && row.web_exclusion_reason !== undefined) {
    if (!validReportExclusionReasons.has(row.web_exclusion_reason)) {
      fail(`report-health.json rows[${index}].web_exclusion_reason is invalid: ${row.web_exclusion_reason}`);
    }
    if (row.web_status !== 'excluded') {
      fail(`report-health.json rows[${index}] has exclusion reason but web_status=${row.web_status}`);
    }
  }
}

const countFiles = {
  reports: 'reports/table.json',
  current_holdings: 'portfolio/holdings.json',
  trades: 'portfolio/trades.json',
  accounts: 'portfolio/accounts.json',
  account_catalog: 'accounts/catalog.json',
  report_board_candidates: 'report-board/candidates.json',
  report_health_rows: 'report-health.json',
};

for (const [key, file] of Object.entries(countFiles)) {
  const expected = manifest.row_counts?.[key];
  if (typeof expected !== 'number') fail(`manifest row_counts.${key} is missing`);
  const actual = rowCount(readJson(file));
  if (actual !== expected) fail(`manifest row_counts.${key}=${expected}, actual ${actual} in ${file}`);
}
if (reportHealth.summary.web_visible !== manifest.row_counts.reports) {
  fail(`report-health visible=${reportHealth.summary.web_visible}, manifest reports=${manifest.row_counts.reports}`);
}
if (reportHealth.summary.web_excluded !== manifest.row_counts.report_health_rows - manifest.row_counts.reports) {
  fail('report-health web_excluded does not match source minus visible reports');
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
const canonicalReportIdentities = reportIdentityMap(readJson('reports.json'), 'reports.json');
const tableReportIdentities = reportIdentityMap(reports, 'reports/table.json');
assertReportIdentitiesMatch('reports/table.json', canonicalReportIdentities, tableReportIdentities);

const detailMetrics = readJson('report-detail-metrics.json');
const detailMetricRows = Object.values(detailMetrics);
const detailReportIdentities = reportIdentityMap(detailMetricRows, 'report-detail-metrics.json');
const detailKeys = new Set(Object.keys(detailMetrics));
for (const reportId of detailReportIdentities.keys()) {
  if (!detailKeys.has(reportId)) fail(`report-detail-metrics.json key is missing for embedded report_id: ${reportId}`);
}
for (const reportId of detailKeys) {
  if (!detailReportIdentities.has(reportId)) {
    fail(`report-detail-metrics.json stale key without embedded report_id: ${reportId}`);
  }
}
assertReportIdentitiesMatch('report-detail-metrics.json', canonicalReportIdentities, detailReportIdentities);
const pageDetailMetrics = readJson('reports/detail-metrics.json');
if (JSON.stringify(pageDetailMetrics) !== JSON.stringify(detailMetrics)) {
  fail('reports/detail-metrics.json diverges from report-detail-metrics.json');
}

const returnWindows = readJson('return-windows.json');
const returnWindowIdentities = reportIdentityMap(returnWindows, 'return-windows.json');
assertReportIdentitiesMatch('return-windows.json', canonicalReportIdentities, returnWindowIdentities);
const pageReturnWindows = readJson('reports/return-windows.json');
if (JSON.stringify(pageReturnWindows) !== JSON.stringify(returnWindows)) {
  fail('reports/return-windows.json diverges from return-windows.json');
}

const reportDownloadRows = parseReportDownloadCsv(
  fs.readFileSync(path.join(webRoot, 'table-download-reports.csv'), 'utf8'),
);
const downloadReportIdentities = reportIdentityMap(reportDownloadRows, 'table-download-reports.csv');
assertReportIdentitiesMatch('table-download-reports.csv', canonicalReportIdentities, downloadReportIdentities);

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
const allowedMissingReleaseStatuses = new Set(['accepted', 'action_required', 'fixed']);
const allowedMissingDecisions = new Set([
  'accepted_exclusion',
  'source_gap',
  'refresh_pending',
  'mapping_replaced',
  'manual_review',
]);
for (const [index, row] of readJson('missing-symbols.json').entries()) {
  if (!row?.symbol) fail(`missing-symbols.json[${index}].symbol is missing`);
  if (!row?.category) fail(`missing-symbols.json[${index}].category is missing`);
  if (!row?.action) fail(`missing-symbols.json[${index}].action is missing`);
  if (!row?.decision) fail(`missing-symbols.json[${index}].decision is missing`);
  if (!row?.release_status) fail(`missing-symbols.json[${index}].release_status is missing`);
  if (!allowedMissingDecisions.has(row.decision)) {
    fail(`missing-symbols.json[${index}].decision is invalid: ${row.decision}`);
  }
  if (!allowedMissingReleaseStatuses.has(row.release_status)) {
    fail(`missing-symbols.json[${index}].release_status is invalid: ${row.release_status}`);
  }
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
const expectedAccountIds = [...new Set(configuredAccountIds)];
const accountIds = accounts.map((row) => row.account_id);
const unexpectedAccountIds = accountIds.filter((id) => !expectedAccountIds.includes(id));
const missingAccountIds = expectedAccountIds.filter((id) => !accountIds.includes(id));
if (unexpectedAccountIds.length) fail(`unexpected account rows: ${unexpectedAccountIds.join(', ')}`);
if (missingAccountIds.length) fail(`missing account rows: ${missingAccountIds.join(', ')}`);
const expectedAccountKinds = new Map(
  configuredAccountIds.map((id) => [id, id === 'all_weather' || id.startsWith('benchmark_') ? 'benchmark' : 'account']),
);
for (const row of accounts) {
  const expectedKind = expectedAccountKinds.get(row.account_id);
  if (row.kind !== expectedKind) {
    fail(`account ${row.account_id} has kind=${row.kind}, expected ${expectedKind}`);
  }
}

console.log(
  `[artifact-check] ok schema=${manifest.schema_version} reports=${reports.length} accounts=${accountIds.length} price_files=${manifest.price_artifact_count}`,
);
