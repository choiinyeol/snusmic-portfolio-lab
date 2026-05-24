import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const explicitFiles = [
  'README.md',
  'DESIGN.md',
  'docs/product-spec.md',
  'docs/technical-architecture.md',
  'docs/data-artifact-policy.md',
  'apps/web/scripts/smoke-static-export.mjs',
];

const frontendDocs = path.join(root, 'docs', 'frontend');
if (fs.existsSync(frontendDocs)) {
  for (const file of fs.readdirSync(frontendDocs).sort()) {
    if (file.endsWith('.md')) explicitFiles.push(path.join('docs', 'frontend', file));
  }
}

const contractBlocked = [
  { id: 'retired-route-main', pattern: /\/main\b/ },
  { id: 'retired-route-review', pattern: /\/review\b/ },
  { id: 'retired-route-screener', pattern: /\/screener\b/ },
  { id: 'retired-route-guide', pattern: /\/guide\b/ },
  { id: 'retired-route-strategies', pattern: /\/strategies\b/ },
  { id: 'retired-report-detail-shape', pattern: /\/reports\/\[symbol\](?!\/\[reportId\])/ },
  { id: 'retired-methodology-route', pattern: /\/portfolio\/\[account\]\/methodology\b/ },
  { id: 'removed-route-copy', pattern: /\b(removed|old|retired)\s+(prototype\s+)?routes?\b/i },
  { id: 'do-not-reintroduce-copy', pattern: /\bdo not reintroduce\b/i },
  { id: 'history-path-copy', pattern: /\b(fallback|legacy|deprecated|rollback|safety-net|migration)\b/i },
];

const currentSourceFiles = [
  ...walkTextFiles(path.join(root, 'apps', 'web'), ['.ts', '.tsx', '.mjs']),
  path.join(root, 'src', 'snusmic_pipeline', 'web', 'artifacts.py'),
  path.join(root, 'tests', 'test_web_artifacts.py'),
].map((file) => path.relative(root, file));

const sourceBlocked = [
  { id: 'old-review-queue-name', pattern: /\breview-queue\b/i },
  { id: 'old-review-artifact-path', pattern: /\breview\/candidates\b/i },
  { id: 'old-review-component-path', pattern: /\bcomponents\/review\b/i },
  { id: 'old-review-view-model-path', pattern: /\bview-models\/review\b/i },
  { id: 'old-review-download-name', pattern: /\bsnusmic-review-filtered\b/i },
  { id: 'old-review-schema-name', pattern: /\bReview(Queue|Candidate|Board)\b/ },
  { id: 'old-review-symbol-name', pattern: /\b(reviewCandidate|review_candidates|_review_queue)\b/ },
];

const failures = [];

for (const relative of explicitFiles) {
  scanFile(relative, contractBlocked, failures);
}

for (const relative of currentSourceFiles) {
  scanFile(relative, sourceBlocked, failures);
}

if (failures.length > 0) {
  console.error('Active contract files must describe only current product surfaces.');
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`active contract check passed: ${explicitFiles.length} files`);

function scanFile(relative, rules, collector) {
  const fullPath = path.join(root, relative);
  if (!fs.existsSync(fullPath)) return;
  const lines = fs.readFileSync(fullPath, 'utf8').split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    for (const rule of rules) {
      if (rule.pattern.test(line)) {
        collector.push(`${relative}:${index + 1}: ${rule.id}: ${line.trim()}`);
      }
    }
  }
}

function walkTextFiles(directory, extensions) {
  if (!fs.existsSync(directory)) return [];
  const out = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      out.push(...walkTextFiles(fullPath, extensions));
    } else if (extensions.includes(path.extname(entry.name))) {
      out.push(fullPath);
    }
  }
  return out;
}
