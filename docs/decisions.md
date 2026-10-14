# mini-habitify decisions

## Established requirements

- Use the stack and modular monolith described in [product-brief.md](product-brief.md), unless the repository has a sensible equivalent.
- Centralize tracking calculations; preserve archived tracker history.
- Enforce user isolation through RLS and authenticated server mutations.
- Keep theme/layout preferences separate from tracking data.
- Multiple styles must support meaningfully different tracking presentations for different preferences, including developer-oriented and playful experiences, with consistent domain behavior.

## Open decisions to settle during implementation

These are intentionally unresolved; agents should choose the simplest maintainable policy, document the rationale, and test it before shipping affected behavior.

| Decision | Why it matters |
| --- | --- |
| User IANA timezone, default selection, and behavior after a timezone change | Daily boundaries, historical grouping, DST, and travel |
| Occurrence timestamps versus explicit tracking dates and backdated entries | Consistent history and correct period queries |
| Habit check-in uniqueness and undo behavior | Retries and multiple entries must not inflate completion |
| Numeric aggregation and target direction | Weight, mood, and pages do not share one automatic sum/target rule |
| Canonical duration unit and display conversion | Storage and progress must remain consistent |
| Week start, period boundaries, and weekday schedules | Weekly/monthly goals and daily dashboard denominator |
| Targetless trackers, over-target progress, and empty periods | Avoid misleading completion and division by zero |
| Negative, zero, and fractional log values by tracker type | Validation needs to match domain meaning |
| Editing tracker goals/schedules and historical progress | Retroactive behavior must be explicit |
| Archive behavior for new logs and historical navigation | Preserve history without accidental future tracking |
| Shared theme catalog versus user-owned preferences/widgets | Correct read/write policy for each table |
| Presentation variants and their relationship to themes/layouts/widgets | Support different experiences without duplicating domain logic |
| Playful visualization metaphor and check-in presentation | Make the experience approachable without assuming rewards or gamification |

## Decision record format

Append dated entries with: decision, context, chosen behavior, affected modules, and verification. Distinguish proposed assumptions from implemented decisions. Do not record credentials or personal data.

## 2026-10-13 — Customization is central

User clarification: people such as developers and children may want different ways to experience tracking. Treat visual style and interaction presentation as core product behavior beyond color changes. A developer-oriented commit-style graph and a playful, approachable presentation must share tracking calculations and persisted logs. Specific playful visuals and preference schema remain design decisions. Affected areas: dashboard, visualizations, appearance preferences, and experience skill. Implementation verification is pending; required checks are consistent progress, working check-ins, and preservation of data/preferences across style changes.

## 2026-10-13 — Implemented tracking and presentation policies

- Timezone: capture a valid IANA timezone at signup, defaulting to the browser’s suggestion. The profile drives Today. Logs store an explicit `tracking_date` plus a UTC timestamp; changing presentation never regroups or modifies logs. A timezone-changing UI is not part of this slice.
- Calendar: Monday-start weeks and actual calendar months; schedules use Sunday=0 through Saturday=6. Entries must be on scheduled days, no earlier than the tracker’s local creation date, and no later than Today. Database triggers enforce these rules on direct API writes too.
- Habits: one completed entry per tracker/date, enforced by a partial unique index; retries are idempotent. Undo removes that entry. Weekly/monthly values count unique completed dates. Daily habit targets are exactly one; longer-period targets are whole counts.
- Counters: sum nonnegative entries, including fractions. Duration: sum canonical seconds; check-in controls accept minutes and convert on the server-validated input path. Numeric: latest recorded entry within the goal period, with creation timestamp/id as ordering; values are not summed.
- Targets: positive “at least” goals, or no target for observations. Numeric lower-is-better/exact/range goals are deferred; observations such as weight should use no target for now. Targetless trackers are excluded from completion denominators. Raw over-target values remain visible while progress bars/rings cap at 100%.
- History: editing a target or weekday schedule applies the new rules retroactively to calculated history; the edit dialog discloses this. Tracker type is immutable in the editing UI. Archiving keeps history and prevents new/edited logs, with entry deletion still available.
- Daily summary/heatmap: the share of scheduled trackers with goals that meet their current period target. A weekly/monthly goal can remain complete across its scheduled days once its period target is reached. Calendar cells use the same engine, not separate daily-only goal semantics. Calculations for past dates exclude later check-ins, and future calendar dates stay incomplete.
- Styles: theme, layout, and presentation are independent choices. Paper/Pastel/Terminal/Brutalist control tokens; Calm/Developer/Playful select interaction/presentation. Developer shows dense cards and a 26-week activity graph; Playful uses larger rounded controls and a seven-day star path. Stars communicate completion, not reward points.
- Preferences: save theme/layout/presentation in user_preferences and activity visibility in dashboard_widgets atomically through an invoker RPC. Both remain isolated by RLS. Theme catalog is shared read-only data.
- Request safety: check-in UUIDs provide idempotency for additive entries; habit uniqueness provides daily idempotency. Every server mutation verifies the authenticated user and validates input; child ownership is also enforced by composite database foreign keys.
- Tooling: use the installed Next.js 16.4 APIs and generated database types. The production build uses Webpack after a reproducible Turbopack CSS-worker port error in this execution environment.

These policies are implemented and covered by domain, real-database, and browser tests. The earlier open-decision table records the original questions; the entries above supersede those questions for the current implementation. Additional numeric goal directions and a timezone-settings UI remain deferred refinements.
