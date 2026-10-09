import { defineConfig } from 'vitest/config';
import * as path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@core': path.resolve(__dirname, 'core') } },
  test: { include: ['tests/**/*.test.ts'] },
});
