# mini-habitify

A personal tracking app with five themes and three selectable experiences. Built with Next.js, strict TypeScript, Supabase Auth/PostgreSQL, Tailwind, and shadcn/ui.

## Local setup

Use Node 24 (or Node 22.13+) and Docker Desktop.

```sh
npm ci
npm run db:start
```

Copy `.env.example` to `.env.local`. Run `npx supabase status` and use only the API URL and **publishable key** for the two public environment variables. Do not put secret or service-role keys in public variables.

```sh
npm run dev
```

Open [localhost:3000](http://localhost:3000) and create an account. Local email confirmation is disabled; every account starts with an empty dashboard. Supabase Studio is available at [localhost:54323](http://localhost:54323).

Migrations run on a fresh local start. To apply new migrations to an existing local database, run `npx supabase migration up`. `npm run db:reset` replays migrations and **deletes local data**; use it only with a disposable development database.

## Implemented

- Signup/login/logout, persistent sessions, password recovery, protected dashboard, and user isolation through RLS.
- Habit, counter, duration, and numeric trackers; targets, periods, weekday schedules, icons/colors, editing, and archiving.
- Reusable private activity templates, immutable versions, a visual field builder with live preview and advanced JSON import, optional structured check-in details, generic forms, and historical detail editing. See [the template guide](docs/activity-templates.md).
- Check-ins, backdated entries within tracker history, entry editing/deletion, shared progress calculations, shareable history pages, month navigation, date filters, paginated entries, daily trend charts, progress ring, and activity graph.
- Paper, Pastel, Terminal, Brutalist, Neumorphism; Standard/Compact layouts; Calm, Developer, and Playful presentations; ready-made experience presets, live preview, custom primary colors with a color picker/hex input and contrast-aware text, and persistent visibility/ordering for summary, activity, and recent widgets.
- Responsive layouts, accessible dialog/form controls, and loading/error/empty states.

Calculation policies and tradeoffs are recorded in [docs/decisions.md](docs/decisions.md). There is no GitHub integration; the graph visualizes this app’s tracker activity.

## Verification

```sh
npm test
npm run typecheck
npm run lint
npm run test:security
npm run test:migrations
npm run test:e2e
npm run build
```

Migration tests create and remove an isolated PostgreSQL database in the local Supabase container, preserving the application database. Use `PLAYWRIGHT_PORT=3011` to test on a separate app port when an older server is already running.

Database and browser tests require local Supabase and `.env.local`. Security tests create disposable accounts through ordinary authentication; they do not use privileged credentials. Playwright starts the app automatically unless one is already running. Install its browser with `npx playwright install chromium` if needed.

To exercise the production build:

```sh
npm run build
PLAYWRIGHT_USE_PRODUCTION=1 npm run test:e2e
```

The build uses Webpack because Turbopack’s CSS worker could not bind its local port in the initial execution environment. No deployment is required for local use.

## Deployment preparation

Follow the [fresh deployment guide](docs/deployment.md) for the Vercel/Supabase setup, hosted auth configuration, and release checks. The GitHub `CI` workflow uses an isolated local Supabase instance and does not need hosted credentials.

For Vercel, configure the two environment variables with the hosted Supabase URL and publishable key. Apply these migrations to the intended hosted database after reviewing its state. Set Supabase’s site URL/redirect allow-list to the deployed domain. For email confirmation, configure the confirmation template to link to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email` and test it in that environment.

Password recovery also requires `NEXT_PUBLIC_APP_URL` set to the deployed app origin and `/auth/callback` in the Supabase redirect allow-list. Configure the recovery email template to link to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`, matching `supabase/templates/recovery.html`. Local recovery emails appear in [Mailpit](http://localhost:54324). Local template/redirect changes require a Supabase restart; do not reset the database to reload them.

Hosted deployment and hosted email confirmation/recovery delivery have not been exercised. The installed development lint toolchain currently has a high-severity transitive `braces` advisory with no compatible patched version reported by the registry; `npm audit --omit=dev` reports zero production vulnerabilities. Resolve or reassess this development dependency finding before a release.
