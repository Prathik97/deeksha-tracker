'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Briefing, BriefingRule } from '@core/briefing';
import type { DayEntry, MantraMethod } from '@core/types';
import type { CheckinRequest } from '@/lib/api-types';
import { unansweredRules } from '@/lib/view';

const CATEGORY_TITLES: Record<string, string> = {
  morning: 'Morning',
  all_day: 'All day',
  diet: 'Diet',
  abstinence: 'Abstinence',
  conduct: 'Conduct',
};

interface Props {
  briefing: Briefing;
  entry: DayEntry | null;
  today: string;
  saving: boolean;
  error: string | null;
  onSubmit: (request: CheckinRequest, passcode: string) => void;
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors ${
        checked ? 'border-saffron-deep bg-saffron' : 'border-neutral-300 bg-neutral-200'
      }`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow ${checked ? 'left-6' : 'left-0.5'}`} />
    </button>
  );
}

export function CheckinForm({ briefing, entry, today, saving, error, onSubmit }: Props) {
  const allRules: BriefingRule[] = useMemo(() => [...briefing.morning, ...briefing.all_day], [briefing]);
  const pending = useMemo(() => unansweredRules(allRules, entry), [allRules, entry]);

  const [values, setValues] = useState<Record<string, boolean>>({});
  const [skipped, setSkipped] = useState<Record<string, boolean>>({});
  const [pradakshina, setPradakshina] = useState(entry?.pradakshina_done ?? false);
  const [mantraMethod, setMantraMethod] = useState<MantraMethod>('video');
  const [passcode, setPasscode] = useState('');
  useEffect(() => {
    try {
      setPasscode(window.localStorage.getItem('deeksha-passcode') ?? '');
    } catch {
      /* storage unavailable */
    }
  }, []);

  if (briefing.status !== 'active') return null;

  if (entry && pending.length === 0) {
    return (
      <section className="rounded-xl border-2 border-saffron-deep bg-white p-4" aria-label="Today's check-in">
        <h2 className="text-lg font-semibold text-neutral-800">Today is done</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Day {briefing.day_number} is logged. Come back tomorrow morning.
        </p>
      </section>
    );
  }

  const groups = pending.reduce<Record<string, BriefingRule[]>>((acc, r) => {
    (acc[r.category] ??= []).push(r);
    return acc;
  }, {});
  const mantraPending = pending.some((r) => r.id === 'mantra_108');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const answers: Record<string, boolean | null> = {};
    for (const r of pending) answers[r.id] = !r.mandatory && skipped[r.id] ? null : (values[r.id] ?? false);
    try {
      window.localStorage.setItem('deeksha-passcode', passcode);
    } catch {
      /* storage unavailable: the passcode just won't be remembered */
    }
    onSubmit(
      {
        date: today,
        answers,
        pradakshina_done: pradakshina,
        mantra_method: mantraPending && answers.mantra_108 === true ? mantraMethod : (entry?.mantra_method ?? null),
      },
      passcode,
    );
  }

  return (
    <form onSubmit={submit} aria-label="Today's check-in" className="rounded-xl border-2 border-neutral-200 bg-white p-4">
      <h2 className="text-lg font-semibold text-neutral-800">Today&apos;s check-in</h2>
      <p className="mt-1 text-sm text-neutral-600">Day {briefing.day_number} · switch on what you kept today.</p>

      {Object.entries(groups).map(([category, rules]) => (
        <fieldset key={category} className="mt-5">
          <legend className="mb-1 text-xs font-bold uppercase tracking-wide text-saffron-dark">
            {CATEGORY_TITLES[category] ?? category}
          </legend>
          <ul className="divide-y divide-neutral-100">
            {rules.map((r) => {
              const isSkipped = !r.mandatory && skipped[r.id] === true;
              return (
                <li key={r.id} className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className={`text-sm ${r.mandatory ? 'font-medium text-red-700' : 'text-neutral-800'} ${isSkipped ? 'opacity-50' : ''}`}>
                      {r.label}
                      {r.mandatory && <span className="ml-1 text-xs">(required)</span>}
                    </span>
                    <Switch
                      checked={!isSkipped && (values[r.id] ?? false)}
                      onChange={(v) => setValues((s) => ({ ...s, [r.id]: v }))}
                      label={r.label}
                    />
                  </div>
                  {r.resource && (
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <a
                        href={r.resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block rounded-lg bg-saffron px-3 py-2 text-sm font-semibold text-white"
                      >
                        Open chanting guide
                      </a>
                      <label className="flex items-center gap-1 text-sm text-neutral-700">
                        Counted by
                        <select
                          value={mantraMethod}
                          onChange={(e) => setMantraMethod(e.target.value as MantraMethod)}
                          className="rounded-md border border-neutral-300 bg-white px-2 py-1"
                        >
                          <option value="video">video</option>
                          <option value="manual">manual</option>
                        </select>
                      </label>
                    </div>
                  )}
                  {!r.mandatory && (
                    <label className="mt-2 flex items-center gap-2 text-xs text-neutral-500">
                      <input
                        type="checkbox"
                        checked={isSkipped}
                        onChange={(e) => setSkipped((s) => ({ ...s, [r.id]: e.target.checked }))}
                      />
                      Skip (not applicable)
                    </label>
                  )}
                </li>
              );
            })}
          </ul>
        </fieldset>
      ))}

      <fieldset className="mt-5">
        <legend className="mb-1 text-xs font-bold uppercase tracking-wide text-saffron-dark">Pradakshina</legend>
        <div className="flex items-center justify-between gap-3 py-2">
          <span className="text-sm text-neutral-800">
            Did a session today? ({briefing.pradakshina.rounds_per_session} rounds)
          </span>
          <Switch checked={pradakshina} onChange={setPradakshina} label="Did a pradakshina session today" />
        </div>
      </fieldset>

      <p className="mt-4 text-xs text-neutral-500">
        A required rule left off is logged as &ldquo;No&rdquo; and flagged. It will not block the check-in.
      </p>
      <label className="mt-4 block text-sm text-neutral-700">
        Passcode
        <input
          type="password"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          autoComplete="off"
          className="mt-1 block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base"
        />
      </label>
      {error && <p className="mt-3 rounded-lg border border-red-500 bg-red-100 p-2 text-sm text-red-800">{error}</p>}
      <button
        type="submit"
        disabled={saving}
        className="mt-4 w-full rounded-xl bg-saffron-deep px-4 py-3 text-base font-semibold text-white disabled:opacity-60"
      >
        {saving ? 'Saving…' : `Log Day ${briefing.day_number}`}
      </button>
    </form>
  );
}
