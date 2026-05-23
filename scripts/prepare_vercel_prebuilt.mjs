import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exit } from 'node:process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const staticOut = join(root, 'apps', 'web', 'out');
const prebuiltOut = join(root, '.vercel', 'output');

if (!existsSync(staticOut)) {
  console.error(
    `${staticOut} does not exist; run python -m snusmic_pipeline refresh-web-artifacts and pnpm --dir apps/web build first`,
  );
  exit(1);
}

rmSync(prebuiltOut, { recursive: true, force: true });
mkdirSync(join(prebuiltOut, 'static'), { recursive: true });
cpSync(staticOut, join(prebuiltOut, 'static'), { recursive: true });
writeFileSync(join(prebuiltOut, 'config.json'), `${JSON.stringify({ version: 3 }, null, 2)}\n`, 'utf8');

console.log(`Prepared Vercel prebuilt output at ${prebuiltOut} from ${staticOut}`);
