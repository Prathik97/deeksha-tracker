# Deeksha Tracker

Daily check-in for the 16-day Karya Siddhi Anjaneya Poorna Phala Deeksha. Logic is a pure TypeScript core; the Claude agent and the CLI are thin adapters over it.

## Layout
```
CLAUDE.md             agent instructions (shells out to the CLI)
schedule-setup.md     9 AM IST reminder setup
schema/               JSON Schemas: vrata_template, enrollment, progress
data/templates/       vrata templates (temple-owned, versioned)
data/devotees/<id>/   enrollment.json (choices) + progress.json (log)
core/                 pure logic + render.ts; cli.ts is the only I/O
tests/                vitest suite (npm test)
```

## Commands
```
npm test                                          # 117 tests
npx ts-node core/cli.ts briefing                  # morning briefing (read-only)
npx ts-node core/cli.ts questions                 # JSON list of what to ask (read-only)
npx ts-node core/cli.ts checkin                   # interactive y/n check-in, writes progress.json
npx ts-node core/cli.ts checkin --answers '<json>'  # non-interactive (used by the agent)
npx ts-node core/cli.ts plan-pradakshina [--days "3 9 10 16"]  # pick/replace planned pradakshina days
```
Flags: `--today YYYY-MM-DD` simulate a day, `--dry-run` do not write, `--devotee <id>`, `--data-dir <path>` use a copy of the data.

## Web app (next-app/)
Next.js 14 + Tailwind, one public page: header, 16-day grid, today's check-in form. Reuses `core/` unchanged.
- `adapters/web/storage.ts`: template from static JSON, enrollment/progress in Vercel KV (`enrollment:user_001`, `progress:user_001`). Without KV credentials in local dev it reads `data/` and writes to `next-app/.dev-data/`.
- `adapters/file/storage.ts`: the file adapter the CLI falls back to.
- API: `GET /api/today`, `GET /api/progress`, `POST /api/checkin` (needs the `x-passcode` header matching `CHECKIN_PASSCODE`; only today can be logged).
- `npx ts-node scripts/seed-kv.ts` copies enrollment/progress into KV. Re-runs never overwrite existing keys; `--force` does.
- Deploy: Vercel project root directory `next-app`, "include source files outside the root directory" on (it imports `../core`, `../adapters`, `../data`, `../schema`). Env vars: KV credentials (from the KV/Upstash store) and `CHECKIN_PASSCODE`.
- Run locally: `npm --prefix next-app run dev`.

## Model
- **Template**: rules, resources, pradakshina methods, special days. Reusable by any devotee.
- **Enrollment**: devotee + template version + start date + timezone + method + rule overrides.
- **Progress**: per-day log (`on_time` / `late`, flags, rule answers), pradakshina dates, special-day actions.

`enrollment.planned_pradakshina_days` (optional, up to 4 day numbers) is the devotee's visit plan: the briefing flags a planned day, warns about planned days that passed without a session, and from Day 8 warns if no plan is set. Pradakshina count = `pradakshina_dates.length`. A mandatory rule answered "no" is recorded and flagged, never blocked. Missed days can be back-filled and are marked `late`.

## Open decision
`weekly_twice` treats the short last week (days 15-16) as needing 2 sessions, as written. Revisit before using that method.

## Roadmap
Next: storage layer, API, multi-temple app (see the build plan).
