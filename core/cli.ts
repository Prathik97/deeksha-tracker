/**
 * Thin adapter: reads the three data files, calls the core, prints rendered output,
 * and (for `checkin`) writes progress.json. This is the only file in core/ that does I/O.
 *
 *   ts-node core/cli.ts briefing  [--devotee user_001] [--today YYYY-MM-DD]
 *   ts-node core/cli.ts questions [--devotee user_001] [--today YYYY-MM-DD] [--date YYYY-MM-DD]
 *   ts-node core/cli.ts plan-pradakshina [--devotee user_001] [--today YYYY-MM-DD] [--days "3 9 10 16"] [--dry-run]
 *   ts-node core/cli.ts checkin   [--devotee user_001] [--today YYYY-MM-DD] [--dry-run] [--data-dir path]
 *                                 [--answers '<json>' | --answers-file path]
 *
 * `checkin` without --answers asks y/n questions on stdin (works in a terminal or with piped lines).
 * With --answers it is non-interactive, which is how the scheduled Claude agent calls it:
 *   [{"date":"2026-10-10","status":"on_time","answers":{"rules":{"morning_bath":true},"pradakshina_done":false}}]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline';
import {
  applyCheckin,
  buildBriefing,
  getDayNumber,
  getMissedDates,
  getQuestions,
  nowIso,
  parseAnswer,
  renderBriefing,
  renderEndMessage,
  summarizeCheckin,
  toLocalDate,
  validateEnrollment,
  validatePlannedDays,
  validateProgress,
  validateReferences,
  validateTemplate,
} from './index';
import { loadEnvFile } from '../adapters/env';
import { FileStorage } from '../adapters/file/storage';
import type { Storage } from '../adapters/storage';
import { KvStorage, kvConfigured } from '../adapters/web/storage';
import type { CheckinAnswers, EntryStatus, Enrollment, Progress, Question, VrataTemplate } from './index';

const ROOT = path.resolve(__dirname, '..');
/** Overridable with --data-dir (used to rehearse a write on a copy of the data). */
const DEFAULT_DATA_DIR = path.join(ROOT, 'data');
let DATA_DIR = DEFAULT_DATA_DIR;

function parseArgs(argv: string[]) {
  const [command, ...rest] = argv;
  const flags: Record<string, string | true> = {};
  for (let i = 0; i < rest.length; i++) {
    if (!rest[i].startsWith('--')) continue;
    const key = rest[i].slice(2);
    const next = rest[i + 1];
    if (next === undefined || next.startsWith('--')) flags[key] = true;
    else {
      flags[key] = next;
      i++;
    }
  }
  return { command, flags };
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

interface Loaded {
  template: VrataTemplate;
  enrollment: Enrollment;
  progress: Progress;
  storage: Storage;
}

/**
 * Where data lives. --data-dir forces local files (rehearsals). Otherwise KV when its credentials
 * are available (env or next-app/.env.local), because the web app writes there; local files are
 * only a fallback and warn on stderr, since using them would split the log from the website.
 */
function selectStorage(devotee: string): Storage {
  if (DATA_DIR !== DEFAULT_DATA_DIR) return new FileStorage(DATA_DIR, devotee);
  loadEnvFile(path.join(ROOT, 'next-app', '.env.local'));
  if (kvConfigured()) return new KvStorage(devotee);
  console.error('Warning: KV credentials not found; using local data files. The website will not see these changes.');
  return new FileStorage(DATA_DIR, devotee);
}

async function load(devotee: string): Promise<Loaded> {
  const storage = selectStorage(devotee);
  const [enrollment, progress] = await Promise.all([storage.getEnrollment(), storage.getProgress()]);
  const template = await storage.getTemplate();

  const problems = [
    ...validateTemplate(template).errors.map((e) => `template: ${e}`),
    ...validateEnrollment(enrollment).errors.map((e) => `enrollment: ${e}`),
    ...validateProgress(progress).errors.map((e) => `progress: ${e}`),
  ];
  if (problems.length === 0) problems.push(...validateReferences(template, enrollment).errors);
  if (problems.length > 0) fail(`Data invalid:\n  ${problems.join('\n  ')}`);
  return { template, enrollment, progress, storage };
}

/** `--today` is a test/dry-run override; otherwise now, interpreted in the enrollment timezone. */
function resolveToday(flags: Record<string, string | true>, tz: string): string {
  return typeof flags.today === 'string' ? flags.today : toLocalDate(new Date(), tz);
}

async function saveProgress(storage: Storage, progress: Progress): Promise<void> {
  const errors = validateProgress(progress).errors;
  if (errors.length > 0) fail(`Refusing to write invalid progress:\n  ${errors.join('\n  ')}`);
  await storage.saveProgress(progress);
}

/** Enrollment with planned_pradakshina_days placed right after pradakshina_method, other keys untouched. */
function withPlannedDays(enrollment: Enrollment, days: number[]): Enrollment {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(enrollment)) {
    if (k === 'planned_pradakshina_days') continue;
    out[k] = v;
    if (k === 'pradakshina_method') out.planned_pradakshina_days = days;
  }
  if (!('planned_pradakshina_days' in out)) out.planned_pradakshina_days = days;
  return out as unknown as Enrollment;
}

// ---------- interactive input ----------

class Prompter {
  private rl = readline.createInterface({ input: process.stdin, terminal: false });
  private lines: string[] = [];
  private waiting: ((line: string | null) => void) | null = null;
  private closed = false;

  constructor() {
    this.rl.on('line', (line) => {
      if (this.waiting) {
        const w = this.waiting;
        this.waiting = null;
        w(line);
      } else this.lines.push(line);
    });
    this.rl.on('close', () => {
      this.closed = true;
      if (this.waiting) this.waiting(null);
    });
  }

  ask(prompt: string): Promise<string> {
    process.stdout.write(`${prompt} `);
    return new Promise((resolve) => {
      const queued = this.lines.shift();
      if (queued !== undefined) return resolve(this.echo(queued));
      if (this.closed) fail('\nInput ended before the check-in was finished. Nothing was saved.');
      this.waiting = (line) => (line === null ? fail('\nInput ended before the check-in was finished. Nothing was saved.') : resolve(this.echo(line)));
    });
  }

  private echo(line: string): string {
    if (!process.stdin.isTTY) process.stdout.write(`${line}\n`);
    return line;
  }

  close(): void {
    this.rl.close();
  }
}

async function askYesNo(p: Prompter, text: string, mandatory: boolean): Promise<boolean | null> {
  for (;;) {
    const parsed = parseAnswer(await p.ask(`${text} (${mandatory ? 'y/n' : 'y/n/skip'})`), mandatory);
    if (parsed !== 'invalid') return parsed;
    console.log(mandatory ? 'Answer y or n.' : 'Answer y, n or skip.');
  }
}

async function runQuestions(p: Prompter, questions: Question[]): Promise<CheckinAnswers> {
  const answers: CheckinAnswers = { rules: {}, special_actions: {} };
  for (const q of questions) {
    if (q.kind === 'rule') {
      answers.rules![q.rule_id] = await askYesNo(p, `${q.label}?`, q.mandatory);
    } else if (q.kind === 'mantra_method') {
      if (answers.rules!.mantra_108 !== true) continue;
      for (;;) {
        const v = (await p.ask('Video or manual count? (video/manual)')).trim().toLowerCase();
        if (v === 'video' || v === 'manual') {
          answers.mantra_method = v;
          break;
        }
        console.log('Answer video or manual.');
      }
    } else if (q.kind === 'pradakshina') {
      const done = await askYesNo(p, 'Pradakshina session today?', true);
      answers.pradakshina_done = done === true;
      if (done === true) {
        const rounds = await askYesNo(p, `${q.rounds} rounds completed?`, true);
        if (rounds === false) console.log(`Note: session recorded; method expects ${q.rounds} rounds.`);
      }
    } else {
      answers.special_actions![q.action_id] = (await askYesNo(p, `${q.label}?`, true)) === true;
    }
  }
  return answers;
}

// ---------- commands ----------

interface AnswerEntry {
  date: string;
  status?: EntryStatus;
  answers: CheckinAnswers;
}

async function checkin(flags: Record<string, string | true>): Promise<void> {
  const devotee = typeof flags.devotee === 'string' ? flags.devotee : 'user_001';
  const { template, enrollment, progress: initial, storage } = await load(devotee);
  const tz = enrollment.timezone;
  const today = resolveToday(flags, tz);
  const dryRun = flags['dry-run'] === true;
  const dayNumber = getDayNumber(enrollment.start_date, today, tz);

  if (initial.is_complete) return void console.log('Deeksha already complete.');
  if (dayNumber < 1 || dayNumber > template.duration_days) {
    return void console.log(renderBriefing(buildBriefing(template, enrollment, initial, today)));
  }

  let progress = initial;
  const ctx = (): { template: VrataTemplate; enrollment: Enrollment; loggedAt: string } => ({
    template,
    enrollment,
    loggedAt: nowIso(new Date(), tz),
  });

  // Non-interactive path (used by the scheduled agent).
  const answersJson =
    typeof flags.answers === 'string'
      ? flags.answers
      : typeof flags['answers-file'] === 'string'
        ? fs.readFileSync(flags['answers-file'], 'utf8')
        : null;
  if (answersJson !== null) {
    const entries = JSON.parse(answersJson) as AnswerEntry[];
    for (const e of entries) {
      progress = applyCheckin(progress, e.date, e.answers, e.status ?? (e.date === today ? 'on_time' : 'late'), ctx());
    }
    await finish(template, enrollment, progress, storage, today, entries.map((e) => e.date), dryRun);
    return;
  }

  // Interactive path.
  const prompter = new Prompter();
  const touched: string[] = [];
  const missed = getMissedDates(template, enrollment, progress, today);
  if (missed.length > 0) {
    console.log(`Not logged: ${missed.join(', ')}`);
    if ((await askYesNo(prompter, 'Back-fill these as late?', true)) === true) {
      for (const date of missed) {
        console.log(`\n== Back-fill ${date} (Day ${getDayNumber(enrollment.start_date, date, tz)}) ==`);
        const answers = await runQuestions(prompter, getQuestions(template, enrollment, progress, date));
        progress = applyCheckin(progress, date, answers, 'late', ctx());
        touched.push(date);
      }
      console.log('\n== Today ==');
    }
  }
  const answers = await runQuestions(prompter, getQuestions(template, enrollment, progress, today));
  progress = applyCheckin(progress, today, answers, 'on_time', ctx());
  touched.push(today);
  prompter.close();
  await finish(template, enrollment, progress, storage, today, touched, dryRun);
}

async function finish(
  template: VrataTemplate,
  enrollment: Enrollment,
  progress: Progress,
  storage: Storage,
  today: string,
  touched: string[],
  dryRun: boolean,
): Promise<void> {
  if (dryRun) console.log('\n(dry run: nothing written)');
  else await saveProgress(storage, progress);
  const summaryDate = touched.includes(today) ? today : touched[touched.length - 1];
  const summary = summarizeCheckin(template, enrollment, progress, summaryDate);
  // Flags from every entry written in this run, not just the last one.
  const labels = new Map(template.rules.map((r) => [r.id, r.label]));
  summary.flagged = touched.flatMap((d) =>
    (progress.days[d]?.flags ?? []).map((id) => (d === summaryDate ? labels.get(id) : `${labels.get(id)} (${d})`) ?? id),
  );
  console.log(`\n${renderEndMessage(summary, template.duration_days)}`);
}

async function planPradakshina(flags: Record<string, string | true>): Promise<void> {
  const devotee = typeof flags.devotee === 'string' ? flags.devotee : 'user_001';
  const { template, enrollment, storage } = await load(devotee);
  const dayNumber = getDayNumber(enrollment.start_date, resolveToday(flags, enrollment.timezone), enrollment.timezone);
  if (dayNumber > template.duration_days) return void console.log('Deeksha period ended. Nothing to plan.');

  const parse = (text: string) => text.split(/[\s,]+/).filter(Boolean).map(Number);
  let days: number[];
  if (typeof flags.days === 'string') {
    days = parse(flags.days);
    const errors = validatePlannedDays(days, dayNumber, template.duration_days);
    if (errors.length > 0) fail(errors.join('\n'));
  } else {
    const prompter = new Prompter();
    for (;;) {
      days = parse(await prompter.ask('Which 4 days do you plan to visit the temple?\nEnter day numbers separated by spaces (e.g. 4 8 12 15):'));
      const errors = validatePlannedDays(days, dayNumber, template.duration_days);
      if (errors.length === 0) break;
      console.log(errors.join('\n'));
    }
    prompter.close();
  }
  days.sort((a, b) => a - b);

  const updated = withPlannedDays(enrollment, days);
  const problems = validateEnrollment(updated).errors;
  if (problems.length > 0) fail(`Refusing to write invalid enrollment:\n  ${problems.join('\n  ')}`);
  if (flags['dry-run'] === true) console.log('(dry run: nothing written)');
  else await storage.saveEnrollment(updated);
  console.log(`Planned: ${days.map((n) => `Day ${n}`).join(', ')}`);
}

async function briefing(flags: Record<string, string | true>): Promise<void> {
  const devotee = typeof flags.devotee === 'string' ? flags.devotee : 'user_001';
  const { template, enrollment, progress } = await load(devotee);
  console.log(renderBriefing(buildBriefing(template, enrollment, progress, resolveToday(flags, enrollment.timezone))));
}

async function questions(flags: Record<string, string | true>): Promise<void> {
  const devotee = typeof flags.devotee === 'string' ? flags.devotee : 'user_001';
  const { template, enrollment, progress } = await load(devotee);
  const today = resolveToday(flags, enrollment.timezone);
  const dates = typeof flags.date === 'string' ? [flags.date] : [...getMissedDates(template, enrollment, progress, today), today];
  const out = dates.map((date) => ({
    date,
    status: date === today ? 'on_time' : 'late',
    day_number: getDayNumber(enrollment.start_date, date, enrollment.timezone),
    questions: getQuestions(template, enrollment, progress, date),
  }));
  console.log(JSON.stringify(out, null, 2));
}

async function main(): Promise<void> {
  const { command, flags } = parseArgs(process.argv.slice(2));
  if (typeof flags['data-dir'] === 'string') DATA_DIR = path.resolve(flags['data-dir']);
  switch (command) {
    case 'briefing':
      return briefing(flags);
    case 'questions':
      return questions(flags);
    case 'checkin':
      return checkin(flags);
    case 'plan-pradakshina':
      return planPradakshina(flags);
    default:
      fail('Usage: ts-node core/cli.ts <briefing|questions|checkin|plan-pradakshina> [--devotee id] [--today YYYY-MM-DD] [--dry-run] [--answers json]');
  }
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
