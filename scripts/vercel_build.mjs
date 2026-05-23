import { existsSync, mkdirSync, readFileSync, rmSync, statSync, cpSync } from 'node:fs';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { exit } from 'node:process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const webDir = join(root, 'apps', 'web');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    stdio: 'inherit',
    shell: false,
  });
  if (result.status !== 0) {
    exit(result.status ?? 1);
  }
}

function canRun(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    stdio: 'ignore',
    shell: false,
  });
  return result.status === 0;
}

function pnpm(args, options = {}) {
  const runner = pnpmRunner();
  if (runner && canRun(runner.command, [...runner.prefixArgs, '--version'], options)) {
    run(runner.command, [...runner.prefixArgs, ...args], options);
    return;
  }
  if (process.platform !== 'win32' && canRun('corepack', ['pnpm', '--version'], options)) {
    run('corepack', ['pnpm', ...args], options);
    return;
  }
  console.error('pnpm is unavailable. Install pnpm or enable Corepack before running the deploy build.');
  exit(1);
}

function pnpmRunner() {
  if (process.platform !== 'win32') {
    return { command: 'pnpm', prefixArgs: [] };
  }

  for (const dir of (process.env.PATH ?? '').split(delimiter)) {
    const pnpmScript = join(dir, 'pnpm.ps1');
    const pnpmCjs = join(dir, 'node_modules', 'pnpm', 'bin', 'pnpm.cjs');
    if (existsSync(pnpmScript) && existsSync(pnpmCjs)) {
      return { command: process.execPath, prefixArgs: [pnpmCjs] };
    }
  }

  return null;
}

function validateWebArtifacts() {
  const manifestPath = join(root, 'data', 'web', 'manifest.json');
  if (!existsSync(manifestPath)) {
    console.error(`Missing required web artifact: ${manifestPath}`);
    console.error('Run python -m snusmic_pipeline refresh-web-artifacts before deploying.');
    exit(1);
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const artifacts = Array.isArray(manifest.artifacts) ? manifest.artifacts : [];
  if (artifacts.length === 0) {
    console.error('Invalid web artifact manifest: artifacts must be a non-empty array.');
    exit(1);
  }

  for (const artifactName of artifacts) {
    const artifactPath = join(root, 'data', 'web', artifactName);
    if (!existsSync(artifactPath) || statSync(artifactPath).size === 0) {
      console.error(`Missing required web artifact: ${artifactPath}`);
      console.error('Run python -m snusmic_pipeline refresh-web-artifacts before deploying.');
      exit(1);
    }
  }
}

validateWebArtifacts();

pnpm(['install', '--frozen-lockfile'], { cwd: webDir });
pnpm(['typecheck'], { cwd: webDir });
pnpm(['build'], { cwd: webDir });
pnpm(['smoke:static'], { cwd: webDir });

const publicDir = join(root, 'public');
rmSync(publicDir, { recursive: true, force: true });
mkdirSync(publicDir, { recursive: true });
cpSync(join(webDir, 'out'), publicDir, { recursive: true });
