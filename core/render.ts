import type { Briefing, BriefingRule } from './briefing';
import type { CheckinSummary } from './checkin';

function renderMorningStep(rule: BriefingRule, n: number): string[] {
  const lines = [`  ${n}. ${rule.label}`];
  if (rule.resource) {
    lines.push(`     ${rule.resource.label}`, `     ${rule.resource.url}`);
    if (rule.resource.note) lines.push(`     ${rule.resource.note}`);
  }
  return lines;
}

/** Text form of a Briefing: short, direct, video link inline at the mantra step. */
export function renderBriefing(b: Briefing): string {
  if (b.status === 'complete') return 'Deeksha already complete.';
  if (b.status === 'not_started') {
    return `Deeksha starts in ${b.days_until_start} day(s), on ${b.start_date}.`;
  }
  if (b.status === 'ended') {
    return [
      `Deeksha period ended (${b.duration_days} days).`,
      `Pradakshinas: ${b.pradakshina.done}/${b.pradakshina.required}`,
    ].join('\n');
  }

  const out: string[] = [
    '---',
    `${b.devotee_name} | Day ${b.day_number} of ${b.duration_days} — ${b.days_left} ${b.days_left === 1 ? 'day' : 'days'} left`,
    `${b.temple.name}, ${b.temple.city}`,
    '',
    'FIRST THING — DO THIS NOW:',
  ];
  b.morning.forEach((rule, i) => out.push(...renderMorningStep(rule, i + 1)));
  out.push('', 'ALL DAY:');
  for (const rule of b.all_day) out.push(`  - ${rule.label}`);
  if (b.planned_today) {
    out.push('', `TODAY IS A PLANNED PRADAKSHINA DAY — ${b.pradakshina.rounds_per_session} rounds at the temple`);
  }

  out.push('', `PRADAKSHINAS: ${b.pradakshina.done}/${b.pradakshina.required} done`);
  out.push(`Method: ${b.pradakshina.method_label}`);
  out.push(`Planned days: ${b.planned_days.length > 0 ? b.planned_days.map((n) => `Day ${n}`).join(', ') : 'not set'}`);
  if (b.pradakshina.warning) out.push(b.pradakshina.warning);
  for (const n of b.missed_planned_days) {
    out.push(`Day ${n} was a planned pradakshina day with no session logged. Reschedule or mark it done.`);
  }
  if (b.no_plan_warning) {
    out.push(`You haven't picked your 4 pradakshina days yet and only ${b.no_plan_warning.days_remaining} days remain. Set them now.`);
  }

  if (b.special_day) {
    out.push('', b.special_day.label);
    for (const a of b.special_day.actions) out.push(`  [${a.done ? 'x' : ' '}] ${a.label}`);
  }
  if (b.earlier_flags.length > 0) {
    out.push('', `Earlier flags: ${b.earlier_flags.map((f) => `${f.date}: ${f.rules.join(', ')}`).join('; ')}`);
  }
  if (b.missed_dates.length > 0) {
    out.push('', `Not logged: ${b.missed_dates.join(', ')} (can be back-filled as late)`);
  }
  out.push('---');
  return out.join('\n');
}

/** One-line end message (plus a flag line when mandatory rules were answered "no"). */
export function renderEndMessage(s: CheckinSummary, durationDays = 16): string {
  const lines: string[] = [];
  if (s.is_last_day && s.is_complete) {
    lines.push(`Deeksha complete. ${durationDays} days done. Go untie the coconut.`);
  } else if (s.is_last_day) {
    const missing = Math.max(s.pradakshina_required - s.pradakshina_done, 0);
    lines.push(`Day ${s.day_number} logged. Pradakshinas: ${s.pradakshina_done}/${s.pradakshina_required}. Deeksha not complete: ${missing} pradakshina session(s) missing.`);
  } else {
    lines.push(`Day ${s.day_number} logged. ${s.days_left} ${s.days_left === 1 ? 'day' : 'days'} left. Pradakshinas: ${s.pradakshina_done}/${s.pradakshina_required}. Keep going.`);
  }
  if (s.flagged.length > 0) lines.push(`Flagged: ${s.flagged.join('; ')}.`);
  return lines.join('\n');
}
