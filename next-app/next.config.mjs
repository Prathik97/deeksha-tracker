import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // core/, adapters/ and schema/ live one level up, outside this app folder.
  experimental: { externalDir: true },
  webpack: (config) => {
    // Files in ../core and ../adapters import packages (date-fns-tz, ajv, @vercel/kv).
    // On Vercel only next-app/ is installed, so resolve bare imports from here too.
    config.resolve.modules = [path.join(here, 'node_modules'), ...(config.resolve.modules ?? [])];
    return config;
  },
};

export default nextConfig;
