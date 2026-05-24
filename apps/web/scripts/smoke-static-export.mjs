import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { cwd, exit } from 'node:process';

const outDir = join(cwd(), 'out');

const expected = [
  ['/', 'index.html'],
  ['/portfolio', 'portfolio/index.html'],
  ['/reports', 'reports/index.html'],
  ['/statistics', 'statistics/index.html'],
];

const failures = [];

for (const [route, file] of expected) {
  if (!existsSync(join(outDir, file))) failures.push(`missing expected static route ${route}: out/${file}`);
}

if (failures.length) {
  console.error(failures.join('\n'));
  exit(1);
}

console.log(`static export smoke passed: ${expected.length} present`);
