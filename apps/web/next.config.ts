import type { NextConfig } from 'next';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  allowedDevOrigins: ['127.0.0.1'],
  poweredByHeader: false,
  images: { unoptimized: true },
  turbopack: {
    root: appRoot,
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'd3'],
  },
};

export default nextConfig;
