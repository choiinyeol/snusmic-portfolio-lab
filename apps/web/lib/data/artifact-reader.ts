import 'server-only';

import fs from 'node:fs';
import path from 'node:path';
import type { z } from 'zod';

const defaultDataRoot = path.resolve(process.cwd(), '../..', 'data', 'web');

export const WEB_DATA_ROOT = process.env.SNUSMIC_WEB_DATA_ROOT
  ? path.resolve(process.env.SNUSMIC_WEB_DATA_ROOT)
  : defaultDataRoot;

const artifactCache = new Map<string, unknown>();

export function readArtifact<T>(relativePath: string, schema: z.ZodType<T>): T {
  if (relativePath.includes('..') || path.isAbsolute(relativePath)) {
    throw new Error(`Invalid artifact path: ${relativePath}`);
  }

  const cached = artifactCache.get(relativePath);
  if (cached !== undefined) {
    return cached as T;
  }

  const fullPath = path.join(WEB_DATA_ROOT, relativePath);
  const raw = JSON.parse(fs.readFileSync(fullPath, 'utf8')) as unknown;
  const parsed = schema.safeParse(raw);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const issuePath = issue?.path.join('.') || '<root>';
    throw new Error(
      `Artifact schema mismatch in ${relativePath}.${issuePath}: ${issue?.message ?? 'unknown schema error'}`,
    );
  }

  artifactCache.set(relativePath, parsed.data);

  return parsed.data;
}
