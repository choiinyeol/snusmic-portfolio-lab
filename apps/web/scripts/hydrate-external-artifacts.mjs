import { mkdirSync, existsSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..');
const manifestPath = path.join(repoRoot, 'data', 'web', 'manifest.json');
const cacheRoot = path.resolve(repoRoot, process.env.SNUSMIC_EXTERNAL_ARTIFACT_CACHE_DIR || '.cache/external-web-artifacts');
const sourceRoot = process.env.SNUSMIC_EXTERNAL_ARTIFACT_SOURCE_DIR
  ? path.resolve(repoRoot, process.env.SNUSMIC_EXTERNAL_ARTIFACT_SOURCE_DIR)
  : null;

if (!existsSync(manifestPath)) {
  throw new Error(`manifest.json not found: ${manifestPath}`);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const entries = Object.entries(manifest.external_artifacts || {});
if (entries.length === 0) {
  console.log('[hydrate-external-artifacts] no external artifacts declared');
  process.exit(0);
}

mkdirSync(cacheRoot, { recursive: true });

for (const [logicalPath, pointer] of entries) {
  const targetPath = path.join(cacheRoot, logicalPath);
  mkdirSync(path.dirname(targetPath), { recursive: true });

  const hydrateFromSourceDir = () => {
    if (!sourceRoot) return false;
    const sourcePath = path.join(sourceRoot, pointer.storage_key || logicalPath);
    if (!existsSync(sourcePath)) return false;
    copyFileSync(sourcePath, targetPath);
    return true;
  };

  const hydrateFromPublicUrl = async () => {
    if (!pointer.public_url) return false;
    const response = await fetch(pointer.public_url);
    if (!response.ok) throw new Error(`Failed to download ${pointer.public_url}: HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    writeFileSync(targetPath, bytes);
    return true;
  };

  let hydrated = hydrateFromSourceDir();
  if (!hydrated) hydrated = await hydrateFromPublicUrl();
  if (!hydrated) {
    throw new Error(
      `Cannot hydrate ${logicalPath}. Set SNUSMIC_EXTERNAL_ARTIFACT_SOURCE_DIR or provide public_url in manifest external_artifacts.`,
    );
  }

  const checksum = createHash('sha256').update(readFileSync(targetPath)).digest('hex');
  if (checksum !== pointer.checksum) {
    throw new Error(`Checksum mismatch for ${logicalPath}: expected ${pointer.checksum}, got ${checksum}`);
  }
}

console.log(`[hydrate-external-artifacts] hydrated ${entries.length} external artifacts into ${cacheRoot}`);
