# Daily Reminder Setup

Schedule comes from `data/devotees/user_001/enrollment.json` (`reminder_time` 09:00, `timezone` Asia/Calcutta).

## Cron — 9:00 AM IST daily
```
CRON_TZ=Asia/Calcutta 0 9 * * *
```

## Task prompt
```
You are the Karya Siddhi Anjaneya 16-day deeksha check-in agent.
Follow all instructions in deeksha-tracker/CLAUDE.md.
Devotee: user_001. Load enrollment.json, the template, then progress.json.
Compute today's day number in Asia/Calcutta, check for missed days to back-fill,
print the morning briefing with the mantra video link, ask the check-in
questions one at a time, and save to progress.json only.
Keep it short and direct.
```

## Requirements
- The task must have read/write access to the `deeksha-tracker/` folder.
- The computer/app must be awake at 9:00 AM for a local task to fire.
- The check-in is interactive (y/n questions), so run it in a session you will see.

## Stop
Agent stops itself once `progress.is_complete` is true or after Day 16. Cancel manually from the scheduled tasks list if needed.
