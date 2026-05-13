import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const repoRoot = join(root, '..', '..');
const sxtHtml = readFileSync(join(root, 'out/reports/SXT/index.html'), 'utf8');
const reportsCsv = readFileSync(join(root, 'public/downloads/snusmic-reports.csv'), 'utf8');
const reportPagePath = join(root, 'app/reports/[symbol]/page.tsx');
const reportDetailCssPath = join(root, 'app/reports/report-detail.css');

const structuralFiles = [
  ['ReportHero', join(root, 'components/reports/ReportHero.tsx')],
  ['PriceEvidencePanel', join(root, 'components/reports/PriceEvidencePanel.tsx')],
  ['PathScenarioPanel', join(root, 'components/reports/PathScenarioPanel.tsx')],
  ['TrendSignalCard', join(root, 'components/reports/TrendSignalCard.tsx')],
  ['ReportSourcesPanel', join(root, 'components/reports/ReportSourcesPanel.tsx')],
];

const sxtReport = parseCsv(reportsCsv).find((row) => row.symbol === 'SXT');
if (!sxtReport) {
  throw new Error('Missing SXT row in public report artifact');
}

const expectedEntryPrice = formatNative(Number(sxtReport.entry_price_native), sxtReport.currency);
const expectedTargetPrice = formatNative(Number(sxtReport.target_price_native), sxtReport.currency);

const required = [
  '25% 가격 수준',
  '75% 가격 수준',
  expectedEntryPrice,
  expectedTargetPrice,
  '페르소나별 매매 내역',
  '가격 레인지와 사후 수익률',
  'Trend following',
  'MA20',
  '페르소나별 매매',
  '최근 체결 흐름',
];
const forbidden = ['25% 경과', '75% 경과', '25%%', '75%%'];
const forbiddenPageSource = ['function PriceScenarioBand', 'function TrendSignalCard'];
const forbiddenGlobalSelectors = ['.report-evidence-grid', '.path-observation-grid', '.trade-ledger'];

for (const text of required) {
  if (!sxtHtml.includes(text)) {
    throw new Error(`Missing report UI contract text: ${text}`);
  }
}
for (const text of forbidden) {
  if (sxtHtml.includes(text)) {
    throw new Error(`Forbidden stale report UI text found: ${text}`);
  }
}

if (!existsSync(reportDetailCssPath)) {
  throw new Error('Missing report detail stylesheet: app/reports/report-detail.css');
}

const pageSource = readFileSync(reportPagePath, 'utf8');
for (const text of forbiddenPageSource) {
  if (pageSource.includes(text)) {
    throw new Error(`Report page still owns extracted component: ${text}`);
  }
}

for (const [exportName, path] of structuralFiles) {
  if (!existsSync(path)) {
    throw new Error(`Missing extracted report component: ${path.replace(`${repoRoot}/`, '')}`);
  }
  const source = readFileSync(path, 'utf8');
  if (!source.includes(`export function ${exportName}`)) {
    throw new Error(`Extracted component does not export ${exportName}: ${path.replace(`${repoRoot}/`, '')}`);
  }
}

const globalCss = readFileSync(join(root, 'app/globals.css'), 'utf8');
for (const selector of forbiddenGlobalSelectors) {
  if (globalCss.includes(selector)) {
    throw new Error(`Report-detail selector leaked back into globals.css: ${selector}`);
  }
}

console.log('report-ui contract check passed');

function parseCsv(source) {
  const [headerLine, ...lines] = source.trim().split(/\r?\n/);
  const headers = parseCsvLine(headerLine);
  return lines.map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? '']));
  });
}

function parseCsvLine(line) {
  const cells = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === ',' && !quoted) {
      cells.push(cell);
      cell = '';
      continue;
    }
    cell += char;
  }

  cells.push(cell);
  return cells;
}

function formatNative(value, currency) {
  if (!Number.isFinite(value)) return '—';
  const code = (currency || 'KRW').toUpperCase();
  const symbol =
    {
      KRW: '₩',
      USD: '$',
      JPY: '¥',
      HKD: 'HK$',
      CNY: '¥',
      EUR: '€',
      CHF: 'CHF ',
      GBP: '£',
      CAD: 'C$',
      AUD: 'A$',
    }[code] ?? `${code} `;
  const digits =
    {
      KRW: 0,
      JPY: 0,
      HKD: 2,
      USD: 2,
      EUR: 2,
      CHF: 2,
      GBP: 2,
      CAD: 2,
      AUD: 2,
      CNY: 2,
    }[code] ?? 2;
  const locale =
    {
      KRW: 'ko-KR',
      JPY: 'ja-JP',
      USD: 'en-US',
    }[code] ?? 'en-US';
  return `${symbol}${value.toLocaleString(locale, { maximumFractionDigits: digits, minimumFractionDigits: digits })}`;
}
