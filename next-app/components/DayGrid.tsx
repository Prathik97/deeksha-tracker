'use client';

import type { GridDay } from '@/lib/view';

function cardClasses(d: GridDay): string {
  const base = 'relative flex h-24 flex-col justify-between rounded-xl border-2 p-2 text-left';
  let tone: string;
  switch (d.state) {
    case 'completed':
      tone = 'bg-saffron-deep text-white border-saffron-deep';
      break;
    case 'partial':
      tone = 'bg-amber-200 text-amber-950 border-amber-300';
      break;
    case 'future':
      tone = 'bg-neutral-100 text-neutral-400 border-neutral-200';
      break;
    case 'missed':
      tone = 'bg-white text-neutral-500 border-neutral-300 border-dashed';
      break;
    default:
      tone = 'bg-white text-neutral-800 border-neutral-300';
  }
  const flagged = d.flagged ? ' !border-red-500 !bg-red-100 !text-red-900' : '';
  const today = d.is_today ? ' ring-4 ring-amber-400' : '';
  return `${base} ${tone}${flagged}${today}`;
}

function status(d: GridDay): string {
  if (d.flagged) return 'Flagged';
  switch (d.state) {
    case 'completed':
      return 'Done';
    case 'partial':
      return 'Partial';
    case 'missed':
      return 'Not logged';
    case 'future':
      return 'Locked';
    default:
      return 'Open';
  }
}

export function DayGrid({ days, onSelect }: { days: GridDay[]; onSelect: (d: GridDay) => void }) {
  return (
    <section aria-label="16-day grid" className="mb-8">
      <h2 className="mb-3 text-lg font-semibold text-neutral-800">16 days</h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {days.map((d) => {
          const logged = d.entry !== null;
          return (
            <li key={d.day_number}>
              <button
                type="button"
                disabled={!logged}
                onClick={() => onSelect(d)}
                aria-label={`Day ${d.day_number}, ${d.label}, ${status(d)}${d.planned ? ', planned pradakshina' : ''}${d.is_today ? ', today' : ''}`}
                className={`${cardClasses(d)} w-full ${logged ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <span className="flex items-start justify-between">
                  <span className="text-xl font-bold leading-none">{d.day_number}</span>
                  <span className="flex items-center gap-1 text-lg leading-none">
                    {d.planned && <span title="Planned pradakshina day" aria-hidden>ॐ</span>}
                    {d.state === 'completed' && <span aria-hidden>✓</span>}
                    {d.state === 'partial' && <span aria-hidden>◐</span>}
                  </span>
                </span>
                <span className="text-sm">
                  <span className="block">{d.label}</span>
                  <span className="block text-xs font-medium">{d.is_today ? 'Today' : status(d)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-neutral-500">ॐ planned pradakshina day · ✓ done · ◐ partly logged · red = a mandatory rule missed</p>
    </section>
  );
}
