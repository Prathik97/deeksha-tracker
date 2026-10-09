import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Enrollment, Progress, VrataTemplate } from '../../core/types';
import type { Storage } from '../storage';

/** The original on-disk layout: data/templates/<id>.json and data/devotees/<devotee>/{enrollment,progress}.json. */
export class FileStorage implements Storage {
  constructor(
    private readonly dataDir: string,
    private readonly devotee: string = 'user_001',
  ) {}

  private get enrollmentFile(): string {
    return path.join(this.dataDir, 'devotees', this.devotee, 'enrollment.json');
  }

  private get progressFile(): string {
    return path.join(this.dataDir, 'devotees', this.devotee, 'progress.json');
  }

  private writeJson(file: string, data: unknown): void {
    // Keep arrays of plain numbers on one line, e.g. "planned_pradakshina_days": [3, 9, 10, 16]
    const text = JSON.stringify(data, null, 2).replace(/\[\s*(-?\d+(?:\s*,\s*-?\d+)*)\s*\]/g, (_, nums: string) =>
      `[${nums.split(',').map((n) => n.trim()).join(', ')}]`,
    );
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, `${text}\n`);
    fs.renameSync(tmp, file);
  }

  async getEnrollment(): Promise<Enrollment> {
    return JSON.parse(fs.readFileSync(this.enrollmentFile, 'utf8'));
  }

  async getTemplate(): Promise<VrataTemplate> {
    const { template_id } = await this.getEnrollment();
    return JSON.parse(fs.readFileSync(path.join(this.dataDir, 'templates', `${template_id}.json`), 'utf8'));
  }

  async getProgress(): Promise<Progress> {
    return JSON.parse(fs.readFileSync(this.progressFile, 'utf8'));
  }

  async saveProgress(progress: Progress): Promise<void> {
    this.writeJson(this.progressFile, progress);
  }

  async saveEnrollment(enrollment: Enrollment): Promise<void> {
    this.writeJson(this.enrollmentFile, enrollment);
  }
}
