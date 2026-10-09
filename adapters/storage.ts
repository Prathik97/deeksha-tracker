import type { Enrollment, Progress, VrataTemplate } from '../core/types';

/** What the engine's callers need from persistence. Implementations: file (CLI), Vercel KV (web + CLI), DB (later). */
export interface Storage {
  getTemplate(): Promise<VrataTemplate>;
  getEnrollment(): Promise<Enrollment>;
  getProgress(): Promise<Progress>;
  saveProgress(progress: Progress): Promise<void>;
  /** Used by `plan-pradakshina`, which edits planned_pradakshina_days. */
  saveEnrollment(enrollment: Enrollment): Promise<void>;
}
