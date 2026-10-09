import { createClient } from '@vercel/kv';
import template from '../../data/templates/karya-siddhi-anjaneya-16day.json';
import type { Enrollment, Progress, VrataTemplate } from '../../core/types';
import type { Storage } from '../storage';

export const DEVOTEE_ID = 'user_001';

/** Template comes from the bundled static JSON; enrollment and progress live in Vercel KV (Redis). */
export class KvStorage implements Storage {
  private readonly client: ReturnType<typeof createClient>;

  constructor(
    private readonly devotee: string = DEVOTEE_ID,
    url = process.env.KV_REST_API_URL,
    token = process.env.KV_REST_API_TOKEN,
  ) {
    if (!url || !token) throw new Error('KV_REST_API_URL / KV_REST_API_TOKEN are not set.');
    this.client = createClient({ url, token });
  }

  async getTemplate(): Promise<VrataTemplate> {
    return template as unknown as VrataTemplate;
  }

  async getEnrollment(): Promise<Enrollment> {
    const value = await this.client.get<Enrollment>(`enrollment:${this.devotee}`);
    if (!value) throw new Error(`enrollment:${this.devotee} not found in KV. Run scripts/seed-kv.ts first.`);
    return value;
  }

  async getProgress(): Promise<Progress> {
    const value = await this.client.get<Progress>(`progress:${this.devotee}`);
    if (!value) throw new Error(`progress:${this.devotee} not found in KV. Run scripts/seed-kv.ts first.`);
    return value;
  }

  async saveProgress(progress: Progress): Promise<void> {
    await this.client.set(`progress:${this.devotee}`, progress);
  }

  async saveEnrollment(enrollment: Enrollment): Promise<void> {
    await this.client.set(`enrollment:${this.devotee}`, enrollment);
  }
}

export function kvConfigured(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

export async function getStorage(): Promise<Storage> {
  if (kvConfigured()) return new KvStorage();
  if (process.env.NODE_ENV !== 'production') {
    // Local development without KV credentials: read the repo's data/ files, write to next-app/.dev-data/.
    const { LocalDevStorage } = await import('./local-dev-storage');
    return new LocalDevStorage();
  }
  throw new Error('KV_REST_API_URL / KV_REST_API_TOKEN are not set. Connect the KV store to this project.');
}
