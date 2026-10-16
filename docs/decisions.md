# mini-habitify decisions

## Established requirements

- Use the stack and modular monolith described in [product-brief.md](product-brief.md), unless the repository has a sensible equivalent.
- Centralize tracking calculations; preserve archived tracker history.
- Enforce user isolation through RLS and authenticated server mutations.
- Keep theme/layout preferences separate from tracking data.
- Multiple styles must support meaningfully different tracking presentations for different preferences, including developer-oriented and playful experiences, with consistent domain behavior.

## Open decisions to settle during implementation

These are intentionally unresolved; agents should choose the simplest maintainable policy, document the rationale, and test it before shipping affected behavior.

| Decision                                                                    | Why it matters                                                            |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| User IANA timezone, default selection, and behavior after a timezone change | Daily boundaries, historical grouping, DST, and travel                    |
| Occurrence timestamps versus explicit tracking dates and backdated entries  | Consistent history and correct period queries                             |
| Habit check-in uniqueness and undo behavior                                 | Retries and multiple entries must not inflate completion                  |
| Numeric aggregation and target direction                                    | Weight, mood, and pages do not share one automatic sum/target rule        |
| Canonical duration unit and display conversion                              | Storage and progress must remain consistent                               |
| Week start, period boundaries, and weekday schedules                        | Weekly/monthly goals and daily dashboard denominator                      |
| Targetless trackers, over-target progress, and empty periods                | Avoid misleading completion and division by zero                          |
| Negative, zero, and fractional log values by tracker type                   | Validation needs to match domain meaning                                  |
| Editing tracker goals/schedules and historical progress                     | Retroactive behavior must be explicit                                     |
| Archive behavior for new logs and historical navigation                     | Preserve history without accidental future tracking                       |
| Shared theme catalog versus user-owned preferences/widgets                  | Correct read/write policy for each table                                  |
| Presentation variants and their relationship to themes/layouts/widgets      | Support different experiences without duplicating domain logic            |
| Playful visualization metaphor and check-in presentation                    | Make the experience approachable without assuming rewards or gamification |

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

## 2026-10-14 — Configurable experiences, history, and account recovery

- Built-in presets are starting points, not separate tracker models. They apply theme/layout/presentation and all widget settings. Users can customize those fields afterward; no tracking data is passed to or modified by preset application.
- Dashboard widgets are summary, activity, and recent. All three are stored exactly once, with enabled flags and positions 0–2. The first enabled widget appears above trackers, with the others below. Reordering uses buttons rather than a drag-and-drop builder.
- `save_dashboard_appearance` validates all three widgets and writes preferences/positions/enabled flags in one transaction under ordinary authenticated RLS. The earlier activity-only RPC remains for compatibility.
- History navigation chooses a month independently of the entry date. Date filters default to that month and may be adjusted separately. Entries paginate at 20 rows; a chart shows daily engine-aggregated raw activity, rather than period-goal completion. Missing numeric measurements are gaps; future/pre-creation dates are excluded.
- History pages live at `/today/trackers/[id]`. Ownership comes from the authenticated data query; unavailable or other-user trackers render the not-found page without private data.
- Password recovery uses Supabase email delivery. Local templates point to `/auth/confirm` with a recovery token hash, and `/auth/callback` supports PKCE defaults. Successful verification creates a session for `/reset-password`. Updating the password requires a validated session and matching 8–128-character passwords, then revokes refresh sessions via global sign-out and returns to login.
- Recovery redirects use configured `NEXT_PUBLIC_APP_URL`, not request-supplied host headers or arbitrary return URLs. Local Supabase uses the localhost site URL and a checked-in recovery template. Hosted setup must configure the deployed site URL, callback allow-list, and email template.
- Recovery requests use the same success message whether an account exists. Missing/expired sessions and used/expired links lead to fresh-link instructions. This work does not add social auth, notifications, GitHub integration, or insights.

## 2026-10-14 — Template-aware activity content (Phase 1)

- Reuse `trackers` and `tracker_logs` as activities and check-ins. Content is separate from the pure metric engine; no activity-specific logic, duplicate progress models, subjects, or analytics were introduced.
- Templates are private to one authenticated user and reusable across that user's trackers. `activity_templates` identifies a template; `activity_template_versions` stores immutable field definitions. Publishing creates a version and updates the current pointer atomically. Historical versions cannot be updated/deleted or reassigned between entries.
- Six field types are text, number, date, select, multi_select, and string list. Stable keys, unique options, bounds, and strict type/key validation run in Zod/server actions and PostgreSQL validators. Selection option values remain exact rather than being normalized when a version is read; native selection controls set explicit option values. PostgreSQL uses the JavaScript whitespace set for nonblank validation. Semantic types are optional metadata only.
- A check-in with no details (`{}`) always records progress, including when its template contains required fields. Once any details are submitted, all required fields must be present. Optional empty controls are omitted. An omitted details property during editing preserves content; explicit `{}` clears it.
- New entries resolve the current version transactionally. Details forms include the expected version and reject stale definitions. Changing/removing the activity template affects future entries only; historical entries edit against their recorded version. Legacy entries remain template-free, even after an association is added.
- Retain the original four-argument `record_log` RPC. The content-aware RPC returns the saved entry ID and preserves request-ID/habit-date idempotency without overwriting details on retries. Content is changed through explicit entry edits. Archive behavior remains unchanged.
- The dashboard's immediate progress controls remain available; generic details are a secondary interaction. History displays version-specific labels/values. The Phase 1 template library imports JSON and publishes new versions; the visual template builder remains Phase 3. See [activity-templates.md](activity-templates.md).
- Local migrations were applied additively, without resetting the application database. A separate disposable database verifies migration replay and pre-existing log preservation. Browser tests can use `PLAYWRIGHT_PORT` to avoid reusing an older app server; recovery tests exercise the delivered email token on the configured test origin.

## 2026-10-15 — Neumorphism appearance theme

- Added Neumorphism as a fifth independent theme, selectable through the existing Appearance preview/save flow. It composes with either layout and all three experiences; it is an appearance option, separate from activity content templates.
- Use pale gray surfaces, paired light/dark shadows for raised panels and buttons, inset inputs and selected navigation, rounded controls, and pink accents. Styling stays under `data-theme="neumorphism"` and shared semantic tokens. No tracking calculations, mutations, or content schemas changed.
- Retain text labels, control borders, explicit selected states, pink keyboard outlines, and reduced-motion behavior. Palette contrast is 10.8:1 for primary text, 5.25:1 for secondary text, and at least 5.6:1 for white button text across the pink gradient.
- A catalog-only additive migration makes the selection persist through the existing authenticated appearance RPC. Existing preferences and logs remain unchanged until the user explicitly saves appearance. No new dependencies or image assets were needed.

## 2026-10-15 — Custom primary colors

- Add an optional per-user `primary_color` override shared across themes. NULL uses the current theme's original colors. Switching themes preserves a chosen override; applying an experience preset or choosing “Use theme default” clears it.
- Appearance provides a native color picker, editable six-digit hex value, quick color choices, live preview, cancellation, and explicit save. Invalid hex drafts show an error and keep the last valid preview; they cannot be submitted. Values normalize to lowercase.
- Keep the selected fill exact. Choose black/white button text by contrast and derive a separate accent ink with at least 4.5:1 contrast across the theme's background, card, and muted surfaces. Use that ink for accent text, focus, progress, chart strokes, and chart scale. Contrast-aware borders keep extreme button colors identifiable.
- A small appearance scope passes the same CSS variables through React context to portalled dialogs. Dashboard, full history, tracker forms, template dialogs, and appearance preview consume one color policy. Default themes retain their original tokens when no override exists.
- Persist color atomically with existing appearance/widget settings through an invoker RPC that delegates to the existing save operation. Existing appearance RPC signatures remain available and preserve a stored color. A database check and server Zod validation accept only opaque six-digit hex values. User isolation continues through existing preferences RLS.
- The migration is additive and leaves existing users on their theme defaults. No tracker/log records or calculation semantics are modified.

## 2026-10-15 — Visual template builder before subjects

- Promote visual template authoring ahead of Phase 2 subjects at the user's request. JSON remains a collapsed advanced option, not the primary authoring flow. This supersedes the earlier deferral of the visual builder.
- Reuse the existing template/version tables, publication action, strict schema, and generic check-in renderer. There is no database migration, new activity-specific logic, nested object engine, or new dependency.
- New fields receive automatically generated stable keys. Renaming, reordering, or changing a field's type keeps its key; importing/editing existing templates retains their original keys and semantic metadata. Selection types retain options when switching between single and multiple choice; changing to a nonselection type removes options.
- Users name templates, configure all six existing types, enter choice options, toggle required flags, remove/reorder fields, and preview the result. Shared schema errors identify invalid fields/options. Preview values remain local, sit outside the save form, and are never sent as check-in data.
- Desktop uses an editor/preview layout with scrollable preview and persistent save controls. Mobile switches between Build form and Preview form. Reordering uses labeled buttons rather than drag-and-drop.
- “Create template” and “Save changes” use the existing immutable publication path. Existing-template edits disclose: “Changes apply to future check-ins. Previous entries stay unchanged.” Version numbers remain automatic. Closing without saving discards the draft.
- Advanced JSON import validates before replacing the draft; invalid JSON leaves the visual draft intact. “Load current definition” exposes the current schema for copying. Subjects remain the next separate phase.

## 2026-10-15 — Shared themed selection controls

- Replace all user-facing native selects in tracker forms, Appearance, template authoring, and structured check-in details with one Radix Select composition. Use the already-installed Radix primitives; no new dependency or database change is needed.
- Menus inherit theme and custom accent tokens through the appearance contexts even when portalled outside a dialog. Keep selection indicators, keyboard/typeahead navigation, Escape dismissal, restored trigger focus, scroll controls, and touch-sized mobile options.
- Use the same accessible control on desktop and mobile. Keep the native form adapter generated internally by Radix hidden from assistive technology; users interact with the themed trigger and option list.
- Encode internal option identifiers to support explicit empty choices without colliding with any user-defined string. Return original values unchanged, including surrounding whitespace. Existing metric semantics, validation, ownership, and persistence remain unchanged.

## 2026-10-15 — Installable PWA foundation

- Add an App Router manifest with stable ID/scope `/`, start URL `/today`, standalone display, PNG icons (including a padded maskable icon), and an Apple touch icon. Keep browser zoom enabled. Cover-mode viewports use safe-area padding; installed dialogs are bounded within the usable screen.
- Register a small same-origin service worker in production, with no new runtime dependency. It caches only a generic `/offline.html` screen. Private pages, React/server responses, API calls, auth callbacks, POSTs, and check-in data are never written to Cache Storage. Offline mutations and queued retries are not implemented.
- Navigations use the network and fall back to the generic offline page only on network failure. Auth callbacks bypass the fallback. The offline screen offers an explicit online retry. Static PWA resources bypass session-refresh middleware; application auth/RLS contracts are unchanged.
- Preserve drafts during worker updates: activate the new worker without forcing a page reload. Bump the worker's cache version when changing the cached offline screen. Retire only this app's older offline caches.
- Install guidance is available on auth and dashboard screens. Chromium's deferred install prompt is used only after an explicit click; iPhone/iPad guidance explains Safari Share → Add to Home Screen. Already-installed apps hide the guidance. Push, background synchronization, offline tracking, and app-store packaging remain out of scope.

## 2026-10-15 — OAuth-only MCP connections

- Expose one stateless Streamable HTTP endpoint at `/mcp` with the official MCP SDK. Discovery uses protected-resource metadata and Supabase's authorization server. Start with six tools: tracker/template/history reads, tracker creation, and retry-safe check-ins. Tracking metrics and template version semantics remain shared with the web app through `src/features/trackers/service.ts`.
- Store explicit per-user/client read/write consent in `mcp_connections`. Native OAuth identity scopes do not limit database access; restrictive RLS combines connection permissions with existing owner policies. Preferences/widgets, connection changes, profile changes and template writes remain unavailable to OAuth clients. The optional write consent covers tracking management through the database API, even though this initial MCP tool set exposes creation/check-ins only.
- The custom access-token hook binds an approved connection to the canonical MCP resource, adds its grant identifier, and uses that resource grant as the OAuth token's session identity. This isolates access tokens from Supabase Auth's first-party account endpoints, while Supabase retains the original session internally for refresh/revocation. Browser tokens are unchanged. MCP requires verified asymmetric JWTs and rejects normal browser credentials.
- Only the `email` OAuth scope is supported; reject `openid` and other scopes before approval. Real tests found that native OAuth access tokens and OIDC identity tokens could otherwise mutate account metadata. The resource-session hook closes the access-token path; avoiding OIDC token issuance closes the identity-token path. Clients requiring OpenID/UserInfo are unsupported. These account-boundary tests are mandatory release gates for Supabase upgrades. See [MCP setup and limitations](mcp.md).
- Disconnect blocks local permissions first, then revokes the native grant/refresh credentials. Every new approval rotates the grant identifier, preventing old tokens from reviving after reconnect. Immediate blocking of issued access tokens uses Connected apps; native revocation outside the app follows ordinary access-token expiry.
- Restrict request origins, bound bodies to 64 KiB, paginate reads to at most 100 records, and limit requests to 120 per user/client/minute in PostgreSQL. Never log tokens or structured activity content. No service-role key is used for routine requests.
- Hosted activation is separate: apply the migration, deploy, configure asymmetric signing and the hook, then enable OAuth/dynamic registration on a fresh OAuth setup. Existing OAuth grants issued without isolation must be revoked/expired before rollout. This task has only configured and tested the local stack.

## 2026-10-16 — Separate MCP OAuth credentials

- Supabase's authorization-server discovery advertises OIDC scopes that ChatGPT automatically requests; native ID tokens cannot be restricted by the access-token hook. Preserve the upstream email-only scope and resource-session boundary rather than allowing OpenID.
- Add an application OAuth gateway using maintained `@node-oauth/oauth2-server` protocol handling, public DCR, exact redirects, S256 PKCE, resource binding, short codes, opaque hashed tokens, refresh rotation/reuse revocation, and a 30-day absolute grant lifetime. No OIDC identity or UserInfo is advertised.
- Use a separate upstream Supabase client/grant per assistant registration. Store upstream credentials encrypted with a server-only AES-GCM key in a private PostgreSQL schema. A restricted gateway login can operate only OAuth storage; routine tracking still uses the signed, isolated user JWT and existing RLS. No service-role data bypass is introduced.
- Bind consent to the exact native authorization request/browser and show the real downstream callback and requested scopes. Use a same-origin consent POST/full navigation; avoid framework rerenders consuming an authorization request twice. Exclude OAuth from PWA navigation fallback.
- Keep existing native connections compatible. Discovery switches to the gateway only when both server settings are configured; new client links must discard cached old issuer/static-client settings. Gateway revoke destroys its token family; Connected apps remains the place to remove the native grant too.
- Hosted rollout remains separate: apply the migration first, provision the restricted login and encryption key, deploy, then test actual ChatGPT/Cursor linking. Local protocol tests cannot prove a hosted client's behavior or enterprise identity linking.

- Hosted rollout found that the Supabase pooler certificate chains to Supabase Root 2021 CA, outside Node’s default trust store. Bundle the vendor-published public CA for Supabase database hosts and require certificate/hostname validation; remove URL SSL overrides so `pg` cannot replace these settings. Verified the restricted hosted login connects over this TLS path and has no tracker read/check-in insert privilege.


## 2026-10-16 — Agent-managed templates and tracker configuration

- Extend the existing generic template/version model and MCP endpoint. No hardcoded reading/exercise/language model or calculation changes. `textarea` shares text validation; `rating` stores an integer with explicit integer `config.min`/`config.max` bounds. Both render in the existing builder/details controls and validate in Zod and PostgreSQL.
- MCP exposes template create/read/update/archive, tracker configuration reads/partial updates, and check-in corrections. Retain `record_check_in` and add `record_checkin` as an alias. A three-times-weekly habit uses target 3 and weekly period, with all weekdays eligible unless specified.
- Template updates upsert complete field definitions by stable key, preserving unmentioned fields. Removal requires explicit keys. The current version ID is an optimistic precondition checked under a database row lock. Every successful update publishes an immutable version; historical content remains tied to its original schema and edits use that schema. Stale expectations use the non-retryable PostgREST `PT409` conflict code: using a serialization failure caused a measured 60-second retry loop. A browser regression requires the conflict response within five seconds.
- `delete_template` archives. Archived templates remain readable and existing tracker associations continue working; new associations and schema publications are rejected. No template, version, or log is physically removed. The template library hides archived choices while existing tracker selection retains its current association.
- Tracker updates send only supplied settings and validate the merged configuration. Type remains immutable; template null detaches future entries. Check-in updates merge supplied detail keys and explicitly remove named keys. Existing no-template and progress-only behavior remains compatible, including the policy that an entirely empty details object is allowed.
- Consent previously explicitly excluded template changes. Add `mcp_connections.can_manage_templates`, default false, and an ownership/grant/write-aware restrictive policy. Fresh explicit write consent covers templates; older clients must reconnect to grant that capability. No account/preferences access is added and no privileged routine data path is used.
- Local migrations are additive and applied without resetting application data. Hosted migration/deployment and actual ChatGPT natural-language acceptance remain release steps, separate from local MCP protocol tests.
