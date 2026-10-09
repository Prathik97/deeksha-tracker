import { NextResponse } from 'next/server';
import { getStorage } from '@adapters/web/storage';
import { buildBriefing } from '@core/briefing';
import { toLocalDate } from '@core/dates';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const storage = await getStorage();
    const [template, enrollment, progress] = await Promise.all([
      storage.getTemplate(),
      storage.getEnrollment(),
      storage.getProgress(),
    ]);
    const today = toLocalDate(new Date(), enrollment.timezone);
    return NextResponse.json(buildBriefing(template, enrollment, progress, today));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to load' }, { status: 500 });
  }
}
