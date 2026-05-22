import type { NextConfig } from 'next';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd(), '../..');

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  poweredByHeader: false,
  images: { unoptimized: true },
  turbopack: {
    root: repoRoot,
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'd3'],
  },
};

export default nextConfig;
