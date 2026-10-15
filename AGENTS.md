# mini-habitify agent guide

## Product and current state

Build mini-habitify, a personal tracking app: “Make your everyday yours.” The complete product brief is [docs/product-brief.md](docs/product-brief.md); read it before planning product work. Habitify is inspiration only; do not copy its branding, UI, or assets.

At setup, this repository contains the brief and agent guidance only. No app, package scripts, database, or Git repository has been initialized. Inspect the current tree on each new task; this statement is a baseline, not proof of the current state.

## Current implementation

The app is now implemented locally. See `README.md` for setup and `docs/implementation-roadmap.md` for verification and release gaps. Use `npm run dev`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run test:security`, `npm run test:e2e`, and `npm run build`. Database/browser tests require local Supabase. `npm run db:reset` deletes local data; do not use it against an account with user data without authorization.

Route composition lives in `src/app`; UI in `src/components`; pure calculations in `src/features/tracker-engine`; preset/widget configuration in `src/features/themes`; history navigation/series in `src/features/history`; validated server mutations in `src/features/trackers/actions.ts`; data loading in `src/features/dashboard`; Supabase clients in `src/lib/supabase`; recovery actions in `src/lib/auth/recovery-actions.ts`. Database types are generated in `src/lib/database.types.ts` from `supabase/migrations`.

Read the implemented policy entries in `docs/decisions.md` before revisiting the original open questions. Styles must keep using the shared engine and mutation contracts. Do not change calculation semantics merely to suit a visualization.

## Working agreement

Follow the user's current scope. Agent setup does not authorize implementing the app. For implementation, first inspect existing code, then produce a concise plan with file-level targets and document material assumptions. Deliver the smallest working slice first: authentication → create habit → check in → progress → persistence after refresh. Continue through the phases in [docs/implementation-roadmap.md](docs/implementation-roadmap.md).

Use a simple feature-oriented modular monolith. Default stack: Next.js App Router, strict TypeScript, Tailwind CSS, shadcn/ui, Supabase Auth/PostgreSQL, Zod, React Hook Form, Recharts, Lucide, Vitest, Playwright, and Vercel. Preserve sensible existing equivalents. Do not invent package commands before a package manifest exists. Consult current official documentation when setting up version-sensitive framework or auth APIs.

## Architecture and invariants

- Keep route composition in `src/app`, feature logic in `src/features`, shared presentation in `src/components`, infrastructure in `src/lib`, and design tokens in `src/styles`. These are intended boundaries; create folders only when needed.
- Share one pure tracker engine across dashboard, details, and visualizations. Keep database access and React out of domain calculations.
- Support habit, counter, duration, and numeric trackers. Resolve unspecified aggregation, goal, and timezone semantics before implementing affected calculations; record decisions in `docs/decisions.md`.
- Treat user identity as authenticated server context, never trusted form input. Validate mutations on the server and enforce ownership with database RLS.
- Preserve log history when archiving. Theme/layout changes affect preferences only.
- Treat multiple tracking experiences as a core differentiator, beyond palette swaps. Support developer-oriented commit-style activity views and playful, approachable presentations through the same domain engine. Users choose styles; do not infer their age or profession. A commit-style graph does not require GitHub integration.
- Use real persisted data in product flows. Fixtures belong in tests or explicitly identified development demos.
- Keep credentials out of source, logs, and client bundles. Service-role keys must never reach the browser. Provide environment variable names through `.env.example` when configuration is introduced.

## Local skills

Read the relevant skill before work in its area. Skills live in `.agents/skills` and can also be selected explicitly by name. If automatic discovery is unavailable, follow these direct links:

| Skill | Use when |
| --- | --- |
| [mini-habitify-delivery](.agents/skills/mini-habitify-delivery/SKILL.md) | Planning or implementing a mini-habitify vertical slice and reporting verification |
| [mini-habitify-tracker-engine](.agents/skills/mini-habitify-tracker-engine/SKILL.md) | Modeling logs, schedules, goals, timezone boundaries, and progress |
| [mini-habitify-supabase-security](.agents/skills/mini-habitify-supabase-security/SKILL.md) | Building auth, data access, migrations, RLS, or user preferences |
| [mini-habitify-experience](.agents/skills/mini-habitify-experience/SKILL.md) | Building dashboards, check-ins, visualizations, themes, or layouts |

These project skills supply domain context; use available framework/design skills when helpful. Do not assume unrelated company workflows or services apply to mini-habitify.

## Verification and handoff

Use unit tests for tracker semantics, database integration tests for authorization, and Playwright for critical user flows. Test a real database path for persistence and user isolation; mocked auth cannot prove RLS. Include type checking, linting, and builds when corresponding scripts exist. Use keyboard and mobile checks for changed UI.

Report what changed, which checks actually ran, results, and any blockers. Never claim completion from a mock or an unrun check. Keep `docs/implementation-roadmap.md` status accurate and decisions durable. Deployment, external account setup, and production data changes remain subject to the user's actual authorization.

## MVP boundaries

Defer GitHub integration, MCP, AI insights, social/team features, push notifications, theme marketplace, arbitrary drag-and-drop layouts, and background timers until the core MVP is complete and the user requests further work.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
