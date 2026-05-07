import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const sxtHtml = readFileSync(join(root, 'out/reports/SXT/index.html'), 'utf8');

const required = [
  '25% 가격 수준',
  '75% 가격 수준',
  '$95.58',
  '$238.00',
  '페르소나별 매매 내역',
  '가격 레인지와 사후 수익률',
  'Trend following',
  'MA20',
  'Strategy activity',
  '최근 체결 흐름',
];
const forbidden = ['25% 경과', '75% 경과', '25%%', '75%%'];

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

console.log('report-ui contract check passed');
