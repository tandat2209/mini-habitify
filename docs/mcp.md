# OAuth MCP access

The remote MCP endpoint is `/mcp`. Connected apps live at `/settings/connections`, linked from Today. Users add the address to a compatible assistant, sign in with their existing account, and approve read-only access or optional tracking management. There are no API keys to generate.

## Tools

- `list_trackers`: active or archived trackers, paginated.
- `get_tracker`: tracker configuration, local today/timezone, current detail schema/version.
- `list_templates`: reusable templates, paginated.
- `get_history`: paginated logs with original template versions.
- `create_tracker`: defaults for all four tracking types, using existing validation.
- `record_check_in`: optional structured details, current template version checking, scheduled local dates, and caller-provided retry UUIDs. Durations use seconds.

Creation is not idempotent. Check-in callers must generate one request UUID for each intended entry and reuse it for retries. Habit uniqueness remains enforced by the existing engine/database contracts. Editing/archiving/deleting tools and template publishing are not exposed in this first tool set. The optional write permission authorizes management of tracking data through Supabase's API too; it does not authorize account, preferences, widgets, or template mutations.

## Security boundaries

Supabase handles client registration, OAuth authorization codes, PKCE, token signing, refresh rotation and native grants. The app supplies consent and a separate `mcp_connections` permission record. OAuth identity scopes do not control database permissions, so restrictive RLS policies enforce these permissions in addition to the existing ownership policies. Routine tools use the user's bearer token and ordinary RLS, without a service-role key.

The access-token hook adds the single approved MCP resource to the audience and a random grant identifier. The OAuth JWT uses that grant identifier as its resource session ID, deliberately distinct from a first-party Supabase Auth session. This is necessary because testing confirmed that an otherwise ordinary Supabase OAuth access token can call account-management APIs. Supabase Auth rejects the resource session as nonexistent; PostgREST verifies the signed JWT and enforces the user/connection policies. The original OAuth session remains inside Supabase for refresh rotation and revocation. Browser tokens are unchanged. MCP verifies the signature, issuer, expiry, role, user/client IDs, resource audience, and resource-session/grant binding before querying permissions.

**Only the `email` OAuth scope is accepted. `openid` is deliberately rejected at consent.** Testing also found that OIDC identity tokens can authenticate to Supabase Auth account APIs; those tokens are outside the access-token hook's control. This integration therefore uses OAuth access tokens only and does not issue OIDC identity tokens. Discovery and the authentication challenge both advertise `email`. Clients that force `openid` or require the OIDC UserInfo endpoint are unsupported. Do not loosen this restriction without rechecking the account API boundary against the actual Supabase Auth version.

Disconnect marks the app grant revoked before revoking the native grant. Existing MCP tokens and direct database access stop immediately. Reconnecting generates a new grant ID, so old tokens never become usable again. Native grant revocation outside the app invalidates refresh credentials; use Connected apps for immediate access-token blocking.

The endpoint accepts bearer headers only, never browser cookies or query-string credentials. It validates origins against the app origin and an optional exact allow-list. Requests are limited to 64 KiB and 120 per user/client/minute using database-backed counters. Results paginate at a maximum of 100 rows. No token or journal content is logged or cached. The PWA does not cache private responses.

## Local setup

1. Apply migrations through `202610150003_mcp_oauth.sql`. Do not reset a database containing wanted data.
2. Configure `NEXT_PUBLIC_APP_URL` to the exact app origin and the existing Supabase public variables.
3. The checked-in local config enables OAuth, dynamic registration, `/oauth/consent`, and the `public.mcp_access_token_hook` custom access-token hook. Restart Supabase after config changes, preserving its database. Fresh local starts apply migrations before Auth starts.
4. Use asymmetric JWT signing keys (ES256 or RS256). MCP signature validation must work through JWKS; legacy symmetric tokens fail closed because the isolated resource session cannot authenticate to Auth's user endpoint.
5. Start the app. Connect an OAuth-capable MCP client to `http://localhost:3000/mcp`, using scope `email`.

`MCP_ALLOWED_ORIGINS` is optional: a comma-separated list of exact browser-client origins, e.g. `https://assistant.example`. Native/server clients normally omit Origin. Do not set a wildcard. Public OAuth metadata permits discovery from any origin; authenticated tool calls use the explicit allow-list.

## Hosted activation (not performed by implementation)

1. Verify this is a fresh OAuth setup. Revoke any pre-existing OAuth grants/tokens before rollout; old tokens issued without the resource-session boundary must expire before enabling external connections. Keep OAuth disabled during setup.
2. Apply the additive migration to the hosted project and deploy the matching application with its exact HTTPS `NEXT_PUBLIC_APP_URL`.
3. Confirm asymmetric signing keys. Enable the custom access-token hook `public.mcp_access_token_hook` in Supabase Auth Hooks **before** allowing external authorization.
4. Set the OAuth authorization path to `/oauth/consent`, using the production Site URL. Enable the OAuth server and dynamic client registration. Registration permits clients to register, but no tracking access exists until user consent; unrecognized OAuth connections are denied by RLS.
5. Verify protected-resource discovery at `/.well-known/oauth-protected-resource/mcp`, Supabase authorization-server discovery, and a real client flow using scope `email`.
6. Verify account updates are forbidden with issued access tokens, no identity token is issued, read-only writes fail, check-ins appear in the web app, refresh works, and disconnect blocks access and refresh.

Supabase's OAuth server is beta. The account API and ID-token tests are release gates for upgrades. External-client compatibility, hosted activation, and physical-device testing remain separate from local automated verification.

## Verification

- Unit tests validate token claim boundaries, safe consent return paths, and allowed OAuth scopes.
- Migration replay preserves legacy logs and tests unapproved/read-only/write/revoked OAuth RLS with ordinary authenticated-role requests in an isolated database.
- Browser tests use real dynamic registration, PKCE, consent, access/refresh tokens and RLS. They cover tool creation/check-in persistence, retry behavior, ownership, direct API bypass attempts, account API denial, grant rotation, template changes/history, login continuation, and mobile decline/no-grant behavior.

References: [Supabase OAuth MCP authentication](https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication), [OAuth token security and RLS](https://supabase.com/docs/guides/auth/oauth-server/token-security), [custom access-token hooks](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook), [MCP authorization](https://modelcontextprotocol.io/specification/latest/basic/authorization).
