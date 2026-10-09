import type { MantraMethod } from '@core/types';

/** Body of POST /api/checkin. */
export interface CheckinRequest {
  date: string;
  answers: Record<string, boolean | null>;
  pradakshina_done: boolean;
  mantra_method: MantraMethod | null;
}
