#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

node <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const manifestPath = path.join('data', 'web', 'manifest.json');
if (!fs.existsSync(manifestPath)) {
  console.error(`Missing required web artifact: ${manifestPath}`);
  console.error('Run scripts/refresh_web_artifacts.sh before deploying.');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const artifacts = Array.isArray(manifest.artifacts) ? manifest.artifacts : [];
if (artifacts.length === 0) {
  console.error('Invalid web artifact manifest: artifacts must be a non-empty array.');
  process.exit(1);
}

for (const artifactName of artifacts) {
  const artifactPath = path.join('data', 'web', artifactName);
  if (!fs.existsSync(artifactPath) || fs.statSync(artifactPath).size === 0) {
    console.error(`Missing required web artifact: ${artifactPath}`);
    console.error('Run scripts/refresh_web_artifacts.sh before deploying.');
    process.exit(1);
  }
}
NODE

corepack enable
corepack prepare pnpm@10.33.2 --activate
(
  cd apps/web
  corepack pnpm install --frozen-lockfile
  corepack pnpm exec biome check .
  corepack pnpm typecheck
  corepack pnpm build
)

rm -rf public
mkdir -p public
cp -R apps/web/out/. public/
