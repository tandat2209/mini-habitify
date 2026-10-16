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

## MCP OAuth gateway

With both gateway environment variables configured, the app is the authorization server for new connections. Its RFC 8414 metadata is `/.well-known/oauth-authorization-server`; protected-resource discovery points there. It advertises only `tracking:read` and `tracking:write`, S256 PKCE, public dynamic client registration, authorization-code/refresh grants, and revocation. It does not advertise OIDC, issue identity tokens, or provide UserInfo. ChatGPT's documented automatic OIDC scope selection therefore no longer follows Supabase's broad discovery document. Actual hosted ChatGPT/Cursor linking still requires a release check.

Assistants receive opaque `mh_a_` access and `mh_r_` refresh tokens. Only SHA-256 hashes are stored. Each registered assistant gets a separate upstream public Supabase client with a fixed gateway callback. The gateway obtains an **email-only**, resource-isolated Supabase grant through the existing sign-in/consent flow. Upstream access/refresh credentials and inner PKCE verifiers are encrypted with AES-256-GCM and never sent to assistants. Tracking requests still use that ordinary user-scoped Supabase JWT and RLS; the gateway's restricted PostgreSQL login has no tracking-table permissions.

Consent displays the actual assistant callback and tracking scopes. Pending authorization is bound to its native authorization ID, an HttpOnly SameSite=Lax browser cookie, inner PKCE, and a ten-minute expiry. Outer PKCE and exact redirect validation are handled by `@node-oauth/oauth2-server`; outer codes expire after two minutes. Consent uses a same-origin POST and a full browser redirect, avoiding duplicate callback consumption during framework rendering. OAuth routes bypass the PWA navigation fallback.

Access tokens last one hour. Refresh tokens rotate, remain bound to the client and resource, and expire at the grant's absolute 30-day deadline. Reusing a consumed refresh token revokes the gateway token family. Database locks serialize code/token consumption and upstream refresh across serverless instances. Upstream credentials refresh internally as needed. Temporary upstream failures fail closed without deleting the grant. Expired transient rows are cleaned during new authorization.

Disconnect or native reapproval deletes gateway credentials, codes, and tokens through a database trigger. The OAuth revocation endpoint also deletes the gateway grant; the native consent row can still appear in Connected apps until disconnected there. Existing direct email-only Supabase connections continue working. No tracker/history data is migrated or reinterpreted.

New Cursor configuration can be URL-only after gateway activation:

```json
{
  "mcpServers": {
    "mini-habitify": {
      "url": "https://mini-habitify.vercel.app/mcp",
      "type": "http"
    }
  }
}
```

Remove the old explicit Supabase `CLIENT_ID`/`email` override when moving a client to the gateway, then start a fresh connection. ChatGPT users should remove/recreate a failed connection so cached Supabase issuer/client metadata is rediscovered. Workspace features requiring verified OIDC identity are outside this tracking-only integration.

## Upstream security boundaries

Supabase handles upstream registration, OAuth codes, PKCE, signed JWTs, refresh rotation and native grants; the maintained OAuth library handles the separate assistant-facing code/token protocol. The app supplies consent and a separate `mcp_connections` permission record. OAuth identity scopes do not control database permissions, so restrictive RLS policies enforce these permissions in addition to the existing ownership policies. Routine tools use the user's bearer token and ordinary RLS, without a service-role key.

The access-token hook adds the single approved MCP resource to the audience and a random grant identifier. The OAuth JWT uses that grant identifier as its resource session ID, deliberately distinct from a first-party Supabase Auth session. This is necessary because testing confirmed that an otherwise ordinary Supabase OAuth access token can call account-management APIs. Supabase Auth rejects the resource session as nonexistent; PostgREST verifies the signed JWT and enforces the user/connection policies. The original OAuth session remains inside Supabase for refresh rotation and revocation. Browser tokens are unchanged. MCP verifies the signature, issuer, expiry, role, user/client IDs, resource audience, and resource-session/grant binding before querying permissions.

**Only the upstream `email` OAuth scope is accepted. `openid` remains rejected at native consent.** Testing also found that OIDC identity tokens can authenticate to Supabase Auth account APIs; those tokens are outside the access-token hook's control. This integration therefore uses OAuth access tokens only and does not issue OIDC identity tokens. Without gateway settings, legacy discovery and challenges advertise `email`. With the gateway enabled, assistants see tracking scopes instead. Clients that force OIDC regardless of discovery or require UserInfo remain unsupported. Do not loosen this restriction without rechecking the account API boundary against the actual Supabase Auth version.

Disconnect marks the app grant revoked before revoking the native grant. Existing MCP tokens and direct database access stop immediately. Reconnecting generates a new grant ID, so old tokens never become usable again. Native grant revocation outside the app invalidates refresh credentials; use Connected apps for immediate access-token blocking.

The endpoint accepts bearer headers only, never browser cookies or query-string credentials. It validates origins against the app origin and an optional exact allow-list. Requests are limited to 64 KiB and 120 per user/client/minute using database-backed counters. Results paginate at a maximum of 100 rows. No token or journal content is logged or cached. The PWA does not cache private responses.

## Local setup

1. Apply migrations through `202610160001_mcp_gateway.sql`. Do not reset a database containing wanted data.
2. Configure `NEXT_PUBLIC_APP_URL` to the exact app origin and the existing Supabase public variables.
3. The checked-in local config enables OAuth, dynamic registration, `/oauth/consent`, and the `public.mcp_access_token_hook` custom access-token hook. Restart Supabase after config changes, preserving its database. Fresh local starts apply migrations before Auth starts.
4. Use asymmetric JWT signing keys (ES256 or RS256). MCP signature validation must work through JWKS; legacy symmetric tokens fail closed because the isolated resource session cannot authenticate to Auth's user endpoint.
5. Run `node scripts/configure-local-mcp-gateway.mjs` to provision a restricted local database login and encryption key in `.env.local`. The script refuses hosted Supabase and preserves existing gateway settings/data. CI uses this script against its disposable stack.
6. Start/restart the app. Connect to `http://localhost:3000/mcp`; new clients discover tracking scopes automatically. Without gateway settings, the legacy email-only path remains active.

`MCP_ALLOWED_ORIGINS` is optional: a comma-separated list of exact browser-client origins, e.g. `https://assistant.example`. Native/server clients normally omit Origin. Do not set a wildcard. Public OAuth metadata permits discovery from any origin; authenticated tool calls use the explicit allow-list.

## Hosted upstream activation

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

## Legacy direct Supabase Cursor scope configuration

Cursor can fall back to the authorization server's advertised scopes, which include `openid`. A URL-only entry can therefore reach the app's unsupported-scope screen even though the MCP resource advertises `email`.

Use Cursor's documented static OAuth configuration to select the scope explicitly. Reuse a public Cursor registration from Supabase Auth → OAuth Apps (or register a public PKCE client), and verify its redirect URIs include `http://localhost:8787/callback` for desktop and `https://www.cursor.com/agents/mcp/oauth/callback` for web/Agents. No client secret is needed for a public client.

Merge this entry into `~/.cursor/mcp.json`, preserving other servers:

```json
{
  "mcpServers": {
    "mini-habitify": {
      "url": "https://mini-habitify.vercel.app/mcp",
      "type": "http",
      "auth": {
        "CLIENT_ID": "YOUR_PUBLIC_CURSOR_CLIENT_ID",
        "scopes": ["email"]
      }
    }
  }
}
```

Reconnect/re-authenticate the server in Cursor after saving. Previously opened consent requests retain their original scopes; start a new connection rather than refreshing an old consent page. The client ID is public registration metadata, not an API key or user credential. See [Cursor's static OAuth configuration](https://prod.cursor.com/docs/mcp#static-oauth-for-remote-servers).

## Gateway deployment

Apply the additive migration **before publishing dependent code**. Provision a password for the `mcp_gateway` role in the hosted database (`ALTER ROLE mcp_gateway LOGIN PASSWORD '<generated-password>';`). This role must remain non-superuser, without BYPASSRLS, memberships, or tracking-table grants. Use the custom-role connection format from your Supabase connection settings, preferably a transaction pooler with verified TLS.

Configure these server-only Vercel variables:

- `MCP_GATEWAY_DATABASE_URL`: restricted `mcp_gateway` login, not `postgres`, an application user's connection, or a service-role API key. URL-encode the password. Require verified TLS on hosted connections (e.g. `sslmode=verify-full`).
- `MCP_GATEWAY_ENCRYPTION_KEY`: one persistent base64-encoded 32-byte random key. Generate using `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. Store it in the deployment secret manager; never commit it. Losing/changing it requires reconnecting gateway clients. Rotating it safely requires a separate credential-reencryption procedure.

Keep the existing Supabase OAuth server, dynamic registration, `/oauth/consent`, and asymmetric access-token hook configuration. The gateway is additive and does not relax those protections. Configure both variables, deploy/redeploy, then verify discovery points to the application issuer and perform fresh ChatGPT and Cursor connections. Existing failed links may cache the old issuer and must be recreated. Public DCR supports `token_endpoint_auth_method=none`; confidential-client registration, CIMD, OIDC/UserInfo, and enterprise verified-email linking are not implemented.

Gateway registration/authorization/token endpoints are limited to 30 requests per minute per operation and platform-provided client IP (shared local bucket outside Vercel), with 16 KiB body bounds. The consent POST requires the exact app Origin. Browser OAuth clients use the same exact `MCP_ALLOWED_ORIGINS` configuration as MCP tools; ordinary server/native clients omit Origin. Canonical `resource` is required on authorization and token/refresh requests.

References: [OpenAI OAuth discovery and OIDC behavior](https://developers.openai.com/plugins/build/auth), [maintained OAuth library](https://github.com/node-oauth/node-oauth2-server), [MCP authorization security](https://modelcontextprotocol.io/specification/latest/basic/security_best_practices).
