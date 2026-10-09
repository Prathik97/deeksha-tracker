import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getStorage } from '@adapters/web/storage';
import { applyCheckin } from '@core/checkin';
import { nowIso, toLocalDate } from '@core/dates';
import { validateProgress } from '@core/validate';
import type { CheckinRequest } from '@/lib/api-types';

export const dynamic = 'force-dynamic';

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

const digest = (v: string) => createHash('sha256').update(v).digest();

/**
 * Check-ins need the passcode set in CHECKIN_PASSCODE (sent as the x-passcode header).
 * In production a missing env var refuses all writes; in local dev it is optional.
 */
function checkPasscode(request: Request): NextResponse | null {
  const expected = process.env.CHECKIN_PASSCODE;
  if (!expected) {
    return process.env.NODE_ENV === 'production' ? bad('Check-ins are disabled: CHECKIN_PASSCODE is not configured.', 503) : null;
  }
  const given = request.headers.get('x-passcode') ?? '';
  return timingSafeEqual(digest(given), digest(expected)) ? null : bad('Wrong or missing passcode.', 401);
}

function parseBody(body: unknown): CheckinRequest | string {
  if (typeof body !== 'object' || body === null) return 'Body must be a JSON object';
  const b = body as Record<string, unknown>;
  if (typeof b.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(b.date)) return 'date must be YYYY-MM-DD';
  if (typeof b.answers !== 'object' || b.answers === null || Array.isArray(b.answers)) return 'answers must be an object';
  for (const [id, v] of Object.entries(b.answers)) {
    if (v !== true && v !== false && v !== null) return `answers.${id} must be true, false or null`;
  }
  if (typeof b.pradakshina_done !== 'boolean') return 'pradakshina_done must be a boolean';
  if (b.mantra_method !== null && b.mantra_method !== 'video' && b.mantra_method !== 'manual') {
    return 'mantra_method must be "video", "manual" or null';
  }
  return b as unknown as CheckinRequest;
}

export async function POST(request: Request) {
  // Cheap guard against cross-site form posts; this is not authentication.
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== request.headers.get('host')) return bad('Cross-origin request refused', 403);

  const denied = checkPasscode(request);
  if (denied) return denied;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return bad('Invalid JSON');
  }
  const body = parseBody(json);
  if (typeof body === 'string') return bad(body);

  try {
    const storage = await getStorage();
    const [template, enrollment, progress] = await Promise.all([
      storage.getTemplate(),
      storage.getEnrollment(),
      storage.getProgress(),
    ]);
    const now = new Date();
    const today = toLocalDate(now, enrollment.timezone);
    if (body.date !== today) return bad(`Only today's check-in can be logged here (today is ${today})`);

    let updated;
    try {
      updated = applyCheckin(
        progress,
        body.date,
        { rules: body.answers, pradakshina_done: body.pradakshina_done, mantra_method: body.mantra_method },
        'on_time',
        { template, enrollment, loggedAt: nowIso(now, enrollment.timezone) },
      );
    } catch (e) {
      return bad(e instanceof Error ? e.message : 'Invalid check-in');
    }

    const check = validateProgress(updated);
    if (!check.valid) return bad(`Refusing to save invalid progress: ${check.errors.join('; ')}`, 500);
    await storage.saveProgress(updated);
    return NextResponse.json(updated);
  } catch (e) {
    return bad(e instanceof Error ? e.message : 'Failed to save', 500);
  }
}
