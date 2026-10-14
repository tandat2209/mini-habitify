---
name: mini-habitify-tracker-engine
description: Implement and test mini-habitify tracker semantics for habits, counters, durations, numeric measurements, schedules, and progress. Use when changing calculation logic or its consumers.
---

# mini-habitify tracker engine

Read the tracker requirements in `docs/product-brief.md` and open semantics in `docs/decisions.md`. Inspect established decisions and existing tests before changing behavior.

Keep domain models and calculations in `src/features/tracker-engine` or its existing equivalent. Functions should take explicit logs, period boundaries, timezone/schedule context, and current time when needed; avoid hidden clock, browser timezone, React, and database dependencies.

Model the four types explicitly. Habits represent completed/not completed; counters sum numeric entries; durations track elapsed quantities; numeric trackers record measurements. Do not assume measurements are additive or all targets mean “at least.” Resolve aggregation, target direction, units, and targetless behavior before implementing their consumers.

Define period intervals consistently, preferably start-inclusive/end-exclusive. Group daily activity by the documented user-timezone policy. Calendar days must not assume 24 elapsed hours. Decide week start and how schedules affect goals and dashboard completion. Keep historical behavior explicit when timezone, goals, or schedules change.

Expose shared calculated results for Today, details, ring, calendar, and heatmap. Preserve raw values where display progress is capped. Presentation components may format outputs but must not redefine completion.

Test selected semantics with empty periods, boundary timestamps, multiple entries, retries/undo, scheduled/off days, targetless/over-target values, and valid zero/fractional values. Include DST and month/year boundaries where calendar logic applies. Test numeric aggregation separately from counter aggregation. Only add cases that exercise supported behavior.
