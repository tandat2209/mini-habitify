# First deployment: private beta

Deploy the Next.js application to Vercel and provision a fresh hosted Supabase project. The repository is `tandat2209/mini-habitify`; the release branch is `main`. Local accounts and tracker data are not copied to the hosted project.

## 1. Prepare accounts and projects

Sign in to [Supabase](https://supabase.com/dashboard) and [Vercel](https://vercel.com/new) with your personal accounts. Create a Supabase organization/project named `mini-habitify`, choosing an appropriate region for its users and saving its database password in your password manager. Review the selected service plan before confirming creation.

Record the project reference, API URL, and publishable key. The application needs only the public API URL and publishable key. Database passwords, access tokens, secret keys, and service-role keys do not belong in the application environment or Git.

## 2. Apply the versioned database schema

From this repository, authenticate the CLI and link the newly created project:

```sh
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase migration list
npx supabase db push --dry-run
```

Check the displayed project and the nine pending migrations before applying:

```sh
npx supabase db push
npx supabase migration list
```

A fresh project should have no existing application data. Do not run `db reset` against a hosted project. Do not paste SQL into the hosted editor to bypass migration history. Verify that user-owned tables have RLS enabled and that the five themes are present.

## 3. Import the application into Vercel

Import `tandat2209/mini-habitify` from GitHub. Use the Next.js preset, repository root directory, Node.js 24.x, install command `npm ci`, and build command `npm run build`. Keep the default Next.js output settings.

Set these environment variables for the intended deployment environment:

| Variable                               | Value                                               |
| -------------------------------------- | --------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Hosted project's HTTPS API URL                      |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Hosted project's publishable key                    |
| `NEXT_PUBLIC_APP_URL`                  | The stable HTTPS application origin, without a path |

Reserve a stable Vercel project domain for the beta; a custom domain is optional. Ensure `NEXT_PUBLIC_APP_URL` matches that domain. Redeploy after changing public environment variables because Next.js embeds them at build time. Do not point preview deployments at a production database with real user data; add a separate Supabase test project when branch previews are needed.

## 4. Configure hosted authentication

In the Supabase Auth settings:

- Set Site URL to the stable HTTPS app origin.
- Allow the exact `https://YOUR_APP_DOMAIN/auth/callback` redirect URL.
- Keep email confirmation enabled for the hosted beta.
- Configure the confirmation template link as `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`.
- Configure the recovery template link as `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery` (see `supabase/templates/recovery.html`).

Configure custom SMTP with a verified sender before inviting ordinary users. Supabase's built-in email sender is restricted and is not intended for production delivery. SMTP credentials are entered in Supabase's dashboard, not in public app variables. Use a transactional email provider and sender domain you control; domain verification is an account setup step.

The checked-in `supabase/config.toml` configures the local development stack; it does not automatically configure the hosted dashboard's site URL, email templates, or SMTP settings.

## 5. Hosted acceptance checks

Use two disposable accounts on the deployed URL:

- Signup, delivered confirmation email, login, refresh, logout, and password recovery through a delivered email.
- Create habit/counter/duration/numeric trackers; record progress; edit/delete entries; confirm persistence after refresh.
- Build and reuse an activity template, add structured details, publish an updated template, and edit an old entry against its original fields.
- Save theme, custom primary color, layout, and widget settings; verify restoration after refresh/login.
- Confirm account B cannot view or mutate account A's tracker/history/template data. Run checks with ordinary authenticated contexts, never a service-role bypass.
- Check mobile/keyboard interactions and the Vercel/Supabase error logs.

The automated browser suite is designed for disposable local Supabase and Mailpit. Do not run it unchanged against hosted users: it creates accounts/test data and its recovery flow expects local Mailpit. Hosted acceptance is a separate release check.

## 6. Release operation

The GitHub `CI` workflow runs formatting, lint, unit tests, production dependency audit, disposable local Supabase security/migration tests, production build/type checking, and Chromium flows. It has no hosted credentials and never deploys migrations. Its first hosted run must be observed before claiming CI is verified. Configure branch protection or Vercel's deployment checks if deployment must wait for CI; a passing workflow is not automatically a deployment gate.

Check the project's database backup/restore options for its selected Supabase plan before relying on the beta for important records. Keep migrations additive. Vercel can roll back application deployments, but that does not reverse database migrations; use a reviewed forward migration for schema repairs.

## Current release evidence

Local security tests: 22 passed. All nine migrations replay successfully in an isolated test database, preserving a legacy check-in. The latest production dependency audit reports no vulnerabilities. The development lint dependency chain still reports the `braces` advisory GHSA-vfj7-8cjw-p6xm; npm's proposed fix downgrades `eslint-config-next` to 14.x and is incompatible with the current Next.js 16 toolchain. It remains a documented development-tool finding; no forced downgrade was applied.

As of 2026-10-15, the app is live at [mini-habitify.vercel.app](https://mini-habitify.vercel.app). The Supabase project is `xaqehhirrjyhkcigpfve` in Singapore. All nine migration versions match locally and remotely. A hosted schema inspection confirms RLS is enabled on all eight application tables; anonymous API reads return no private rows and the public catalog returns five themes.

[The first GitHub CI run passed](https://github.com/tandat2209/mini-habitify/actions/runs/38736379208) for commit `a3f8110`. Vercel deployment `49zS9dKMGxsCuXYMRCfzWVqrSyt2` is Ready and owns the production domain. The three application environment variables are scoped to Production. Supabase Site URL is the verified production origin and the redirect allow-list contains its exact `/auth/callback` URL.

The live login/signup pages load, and unauthenticated `/today` requests redirect to login. Full hosted signup/confirmation/recovery, signed-in tracking persistence, and two-account isolation checks remain outstanding. Email confirmation remains enabled. No sender domain or custom SMTP provider is configured; Supabase's default sender restrictions apply. On the current hosted plan, the dashboard requires custom SMTP (or a plan upgrade) before email templates can be customized. Do not treat the beta as ready for general email signup until delivery and callback flows are verified.

## References

- [Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs)
- [Supabase migrations](https://supabase.com/docs/guides/deployment/database-migrations)
- [Supabase production checklist](https://supabase.com/docs/guides/deployment/going-into-prod)
- [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
