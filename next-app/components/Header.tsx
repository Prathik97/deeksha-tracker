import type { Briefing } from '@core/briefing';

function pillText(b: Briefing): string {
  switch (b.status) {
    case 'complete':
      return 'Deeksha complete';
    case 'not_started':
      return `Starts in ${b.days_until_start} day(s)`;
    case 'ended':
      return 'Deeksha period ended';
    default:
      return `Day ${b.day_number} of ${b.duration_days} — ${b.days_left} ${b.days_left === 1 ? 'day' : 'days'} left`;
  }
}

export function Header({ briefing: b }: { briefing: Briefing }) {
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-bold text-neutral-800">Karya Siddhi Anjaneya Deeksha</h1>
      <p className="mt-1 text-sm text-neutral-600">
        {b.devotee_name} · {b.temple.name}, {b.temple.city}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-saffron px-3 py-1 text-sm font-semibold text-white">{pillText(b)}</span>
        <span className="rounded-full border border-saffron px-3 py-1 text-sm font-medium text-saffron-dark">
          {b.pradakshina.done}/{b.pradakshina.required} sessions done
        </span>
      </div>
      {b.status === 'active' && b.pradakshina.warning && (
        <p className="mt-3 rounded-lg border border-red-500 bg-red-100 p-3 text-sm text-red-800">{b.pradakshina.warning}</p>
      )}
      {b.status === 'active' && b.planned_today && (
        <p className="mt-3 rounded-lg border border-amber-400 bg-amber-100 p-3 text-sm font-medium text-amber-900">
          Today is a planned pradakshina day — {b.pradakshina.rounds_per_session} rounds at the temple
        </p>
      )}
      {b.missed_planned_days.map((n) => (
        <p key={n} className="mt-3 rounded-lg border border-red-500 bg-red-100 p-3 text-sm text-red-800">
          Day {n} was a planned pradakshina day with no session logged. Reschedule or mark it done.
        </p>
      ))}
      {b.no_plan_warning && (
        <p className="mt-3 rounded-lg border border-red-500 bg-red-100 p-3 text-sm text-red-800">
          You haven&apos;t picked your 4 pradakshina days yet and only {b.no_plan_warning.days_remaining} days remain.
          Set them now.
        </p>
      )}
    </header>
  );
}
