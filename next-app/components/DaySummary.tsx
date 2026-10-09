'use client';

import type { Rule } from '@core/types';
import type { GridDay } from '@/lib/view';

function value(v: boolean | null | undefined): { text: string; className: string } {
  if (v === true) return { text: 'Yes', className: 'text-green-700' };
  if (v === false) return { text: 'No', className: 'font-semibold text-red-700' };
  if (v === null) return { text: 'Skipped', className: 'text-neutral-500' };
  return { text: 'Not answered', className: 'text-neutral-400' };
}

export function DaySummary({ day, rules, onClose }: { day: GridDay; rules: Record<string, Rule>; onClose: () => void }) {
  const entry = day.entry;
  if (!entry) return null;
  return (
    <div
      className="fixed inset-0 z-10 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Day ${day.day_number} summary`}
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-cream p-4 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold">
              Day {day.day_number} · {day.label}
            </h3>
            <p className="text-xs text-neutral-500">
              Logged {entry.entry_status === 'late' ? 'late' : 'on time'} · {entry.logged_at.replace('T', ' ').slice(0, 16)}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md border border-neutral-300 px-2 py-1 text-sm">
            Close
          </button>
        </div>
        {entry.flags.length > 0 && (
          <p className="mt-3 rounded-lg border border-red-500 bg-red-100 p-2 text-sm text-red-800">
            Flagged: {entry.flags.map((id) => rules[id]?.label ?? id).join('; ')}
          </p>
        )}
        <ul className="mt-3 divide-y divide-neutral-200">
          {Object.entries(entry.rules_checked).map(([id, v]) => {
            const r = value(v);
            return (
              <li key={id} className="flex items-start justify-between gap-3 py-2 text-sm">
                <span>{rules[id]?.label ?? id}</span>
                <span className={`shrink-0 ${r.className}`}>{r.text}</span>
              </li>
            );
          })}
          <li className="flex justify-between py-2 text-sm">
            <span>Pradakshina session</span>
            <span className={entry.pradakshina_done ? 'text-green-700' : 'text-neutral-500'}>
              {entry.pradakshina_done ? 'Yes' : 'No'}
            </span>
          </li>
          {entry.mantra_method && (
            <li className="flex justify-between py-2 text-sm">
              <span>Mantra</span>
              <span className="capitalize text-neutral-700">{entry.mantra_method}</span>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
