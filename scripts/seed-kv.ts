/**
 * Load the local enrollment.json and progress.json into Vercel KV.
 *
 *   npx ts-node scripts/seed-kv.ts          # writes only keys that do not exist yet
 *   npx ts-node scripts/seed-kv.ts --force  # overwrites existing keys (discards check-ins made on the web!)
 *
 * Safe to re-run: by default an existing key is left alone, so a re-run can never wipe web check-ins.
 * Credentials come from KV_REST_API_URL / KV_REST_API_TOKEN in the environment or next-app/.env.local
 * (created by `vercel env pull`).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createClient } from '@vercel/kv';
import { loadEnvFile } from '../adapters/env';

const ROOT = path.resolve(__dirname, '..');
const DEVOTEE = 'user_001';

async function main(): Promise<void> {
  loadEnvFile(path.join(ROOT, 'next-app', '.env.local'));
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    console.error('KV_REST_API_URL / KV_REST_API_TOKEN not found. Run `vercel env pull` in the linked project first.');
    process.exit(1);
  }
  const force = process.argv.includes('--force');
  const client = createClient({ url, token });

  for (const [key, file] of [
    [`enrollment:${DEVOTEE}`, path.join(ROOT, 'data', 'devotees', DEVOTEE, 'enrollment.json')],
    [`progress:${DEVOTEE}`, path.join(ROOT, 'data', 'devotees', DEVOTEE, 'progress.json')],
  ] as const) {
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    const result = force ? await client.set(key, value) : await client.set(key, value, { nx: true });
    console.log(`${key}: ${result === null ? 'already exists, left unchanged' : force ? 'written (forced)' : 'written'}`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
