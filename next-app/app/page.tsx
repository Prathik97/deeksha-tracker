import { getStorage } from '@adapters/web/storage';
import { toLocalDate } from '@core/dates';
import { Tracker } from '@/components/Tracker';

export const dynamic = 'force-dynamic';

export default async function Page() {
  try {
    const storage = await getStorage();
    const [template, enrollment, progress] = await Promise.all([
      storage.getTemplate(),
      storage.getEnrollment(),
      storage.getProgress(),
    ]);
    const today = toLocalDate(new Date(), enrollment.timezone);
    return <Tracker template={template} enrollment={enrollment} initialProgress={progress} today={today} />;
  } catch (e) {
    return (
      <main className="mx-auto max-w-xl px-4 py-10">
        <h1 className="text-xl font-semibold">Karya Siddhi Anjaneya Deeksha</h1>
        <p className="mt-4 rounded-lg border border-red-500 bg-red-100 p-3 text-sm text-red-800">
          Could not load data: {e instanceof Error ? e.message : 'unknown error'}
        </p>
      </main>
    );
  }
}
