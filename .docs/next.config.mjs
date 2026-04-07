import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE_PATH = '/clawless';
const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  outputFileTracingRoot: ROOT_DIR,
  basePath: BASE_PATH,
  assetPrefix: BASE_PATH,
  env: {},
};

export default nextConfig;
