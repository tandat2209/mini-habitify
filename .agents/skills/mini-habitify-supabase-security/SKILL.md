---
name: mini-habitify-supabase-security
description: Build mini-habitify Supabase authentication, migrations, RLS, and validated data mutations. Use for user-owned tracking data, preferences, and database authorization work.
---

# mini-habitify Supabase security

Read `AGENTS.md`, database requirements in `docs/product-brief.md`, and relevant decisions in `docs/decisions.md`. Inspect existing clients/migrations and installed versions; consult current official Supabase/Next.js guidance for session APIs.

Use separate browser and server client boundaries. Derive identity from validated authenticated server context; do not accept ownership from request input. Validate mutations with Zod and enforce domain constraints on the server. Keep service-role credentials out of client imports, public environment variables, and logs. Do not use privileged access to bypass user authorization in routine product requests.

Version schema changes in `supabase/migrations`; they must replay from a fresh database. Required MVP tables are profiles, trackers, tracker_logs, themes, user_preferences, and dashboard_widgets. Add UUID keys where appropriate, ownership/foreign-key constraints, and indexes for actual user/tracker/date queries.

Enable RLS for every user-owned table. Address SELECT/INSERT/UPDATE/DELETE separately; ensure update checks prevent ownership transfer. For logs and other child rows, verify the referenced parent belongs to the authenticated user, including cross-user foreign-key attempts. Decide and document whether themes form a shared read-only catalog; do not apply owner-only policies blindly to catalog data.

Store timestamps consistently and enforce the chosen date/timezone policy. Archive trackers while preserving history. Preferences/widgets writes must never modify tracker or log data.

Verify with anonymous, user A, and user B contexts against a real database: owned access succeeds; other-user reads/writes, owner reassignment, and child insertion against another user's tracker fail. Test these through the ordinary authenticated role, not a service-role client. Exercise session persistence/logout and migration replay where changed. State clearly when real database checks could not run.
