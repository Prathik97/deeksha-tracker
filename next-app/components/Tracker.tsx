'use client';

import { useMemo, useState } from 'react';
import { buildBriefing } from '@core/briefing';
import { applyCheckin } from '@core/checkin';
import { nowIso } from '@core/dates';
import type { Enrollment, Progress, VrataTemplate } from '@core/types';
import type { CheckinRequest } from '@/lib/api-types';
import { buildGrid, type GridDay } from '@/lib/view';
import { CheckinForm } from './CheckinForm';
import { DayGrid } from './DayGrid';
import { DaySummary } from './DaySummary';
import { Header } from './Header';

interface Props {
  template: VrataTemplate;
  enrollment: Enrollment;
  initialProgress: Progress;
  /** Today's date (YYYY-MM-DD) in the enrollment timezone, computed on the server. */
  today: string;
}

export function Tracker({ template, enrollment, initialProgress, today }: Props) {
  const [progress, setProgress] = useState(initialProgress);
  const [selected, setSelected] = useState<GridDay | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const briefing = useMemo(() => buildBriefing(template, enrollment, progress, today), [template, enrollment, progress, today]);
  const grid = useMemo(() => buildGrid(template, enrollment, progress, today), [template, enrollment, progress, today]);
  const ruleLabels = useMemo(() => Object.fromEntries(template.rules.map((r) => [r.id, r])), [template]);

  async function submit(request: CheckinRequest, passcode: string) {
    const previous = progress;
    setError(null);
    setSaving(true);
    try {
      // Optimistic: apply the same pure engine function the server will run.
      setProgress(
        applyCheckin(
          previous,
          request.date,
          { rules: request.answers, pradakshina_done: request.pradakshina_done, mantra_method: request.mantra_method },
          'on_time',
          { template, enrollment, loggedAt: nowIso(new Date(), enrollment.timezone) },
        ),
      );
      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-passcode': passcode },
        body: JSON.stringify(request),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Could not save');
      setProgress(body as Progress);
    } catch (e) {
      setProgress(previous);
      setError(e instanceof Error ? e.message : 'Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
      <Header briefing={briefing} />
      <DayGrid days={grid} onSelect={setSelected} />
      <CheckinForm
        key={`${today}-${progress.days[today] ? 'logged' : 'new'}`}
        briefing={briefing}
        entry={progress.days[today] ?? null}
        today={today}
        saving={saving}
        error={error}
        onSubmit={submit}
      />
      {selected && <DaySummary day={selected} rules={ruleLabels} onClose={() => setSelected(null)} />}
    </main>
  );
}
