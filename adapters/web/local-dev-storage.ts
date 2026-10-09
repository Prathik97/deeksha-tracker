import * as fs from 'node:fs';
import * as path from 'node:path';
import template from '../../data/templates/karya-siddhi-anjaneya-16day.json';
import type { Enrollment, Progress, VrataTemplate } from '../../core/types';
import type { Storage } from '../storage';

/**
 * Development fallback used only when KV credentials are absent. Reads the repo's data/ files and
 * writes progress to next-app/.dev-data/ so the real progress.json is never touched.
 */
export class LocalDevStorage implements Storage {
  private readonly dataDir = path.resolve(process.cwd(), '..', 'data', 'devotees', 'user_001');
  private readonly devDir = path.resolve(process.cwd(), '.dev-data');

  async getTemplate(): Promise<VrataTemplate> {
    return template as unknown as VrataTemplate;
  }

  async getEnrollment(): Promise<Enrollment> {
    const devFile = path.join(this.devDir, 'enrollment.json');
    const file = fs.existsSync(devFile) ? devFile : path.join(this.dataDir, 'enrollment.json');
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }

  async getProgress(): Promise<Progress> {
    const devFile = path.join(this.devDir, 'progress.json');
    const file = fs.existsSync(devFile) ? devFile : path.join(this.dataDir, 'progress.json');
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }

  async saveEnrollment(enrollment: Enrollment): Promise<void> {
    fs.mkdirSync(this.devDir, { recursive: true });
    fs.writeFileSync(path.join(this.devDir, 'enrollment.json'), `${JSON.stringify(enrollment, null, 2)}\n`);
  }

  async saveProgress(progress: Progress): Promise<void> {
    fs.mkdirSync(this.devDir, { recursive: true });
    fs.writeFileSync(path.join(this.devDir, 'progress.json'), `${JSON.stringify(progress, null, 2)}\n`);
  }
}
