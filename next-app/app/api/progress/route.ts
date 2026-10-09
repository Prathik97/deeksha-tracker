import { NextResponse } from 'next/server';
import { getStorage } from '@adapters/web/storage';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const storage = await getStorage();
    return NextResponse.json(await storage.getProgress());
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to load' }, { status: 500 });
  }
}
