import "server-only";
import OAuth from "@node-oauth/oauth2-server";
import { z } from "zod";
import { authorizationIdSchema } from "../security";
import { mcpConfig } from "../config";
import { supabaseConfig } from "@/lib/supabase/config";
import {
  authorizationSchema,
  registrationSchema,
  digest,
  randomToken,
  encrypt,
  decrypt,
  gatewayScopes,
} from "./security";
import { gatewayEnabled, gatewayKey, transaction, rateLimit } from "./store";
import { oauthServer } from "./model";
import { exchangeUpstream, verifyUpstream } from "./upstream";
const privateHeaders = {
  "Cache-Control": "no-store",
  Pragma: "no-cache",
  "Referrer-Policy": "no-referrer",
};
export function gatewayMetadata() {
  const { origin } = mcpConfig();
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/mcp/authorize`,
    token_endpoint: `${origin}/oauth/mcp/token`,
    registration_endpoint: `${origin}/oauth/mcp/register`,
    revocation_endpoint: `${origin}/oauth/mcp/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: gatewayScopes,
    authorization_response_iss_parameter_supported: true,
  };
}
export function discovery() {
  if (!gatewayEnabled())
    return fail(
      "temporarily_unavailable",
      "MCP gateway setup is not complete.",
      503,
    );
  return Response.json(gatewayMetadata(), {
    headers: { ...privateHeaders, "Access-Control-Allow-Origin": "*" },
  });
}
function fail(error: string, description: string, status = 400) {
  return Response.json(
    { error, error_description: description },
    { status, headers: privateHeaders },
  );
}
function redirectTo(location: string, cookie?: string) {
  const headers = new Headers({ ...privateHeaders, Location: location });
  if (cookie) headers.set("Set-Cookie", cookie);
  return new Response(null, { status: 302, headers });
}
export async function readGatewayBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 16384) {
      await reader.cancel();
      throw new OAuth.InvalidRequestError("Request exceeds 16 KiB.");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
function unique(params: URLSearchParams) {
  const result: Record<string, string> = {};
  for (const [key, value] of params) {
    if (key in result)
      throw new OAuth.InvalidRequestError("Duplicate request parameter.");
    result[key] = value;
  }
  return result;
}
export async function handleGateway(
  request: Request,
  operation: "register" | "authorize" | "callback" | "token" | "revoke",
) {
  if (!gatewayEnabled())
    return fail(
      "temporarily_unavailable",
      "MCP gateway setup is not complete.",
      503,
    );
  try {
    if (!(await rateLimit(request, operation)))
      return fail(
        "temporarily_unavailable",
        "Too many requests. Try again shortly.",
        429,
      );
    if (operation === "register") return await register(request);
    if (operation === "authorize") return await authorize(request);
    if (operation === "callback") return await callback(request);
    if (operation === "token") return await token(request);
    return await revoke(request);
  } catch (error) {
    if (error instanceof SyntaxError)
      return fail("invalid_request", "Invalid JSON request.");
    if (error instanceof z.ZodError)
      return fail(
        "invalid_request",
        "Invalid OAuth parameters. Use tracking scopes and S256 PKCE.",
      );
    if (error instanceof OAuth.OAuthError && error.code < 500)
      return fail(error.name, error.message, error.code);
    // Never expose SQL errors, upstream responses, tokens or credentials.
    return fail(
      "temporarily_unavailable",
      "Authorization is temporarily unavailable. Start again from your assistant.",
      503,
    );
  }
}
async function register(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json"))
    return fail("invalid_client_metadata", "Send JSON client metadata.");
  const metadata = registrationSchema.parse(
    JSON.parse(await readGatewayBody(request)),
  );
  const { url, key } = supabaseConfig();
  const response = await fetch(`${url}/auth/v1/oauth/clients/register`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: metadata.client_name,
      redirect_uris: [`${mcpConfig().origin}/oauth/mcp/callback`],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    }),
    signal: AbortSignal.timeout(15000),
    redirect: "error",
  });
  if (!response.ok) throw new Error("Upstream registration unavailable.");
  const upstream = z
    .object({ client_id: z.uuid() })
    .parse(await response.json());
  const id = crypto.randomUUID();
  await transaction(async (db) => {
    await db.query(
      "insert into mcp_gateway.clients(id,upstream_id,metadata) values($1,$2,$3)",
      [id, upstream.client_id, metadata],
    );
  });
  return Response.json(
    {
      ...metadata,
      client_id: id,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      scope: gatewayScopes.join(" "),
    },
    { status: 201, headers: privateHeaders },
  );
}
async function authorize(request: Request) {
  const params = authorizationSchema.parse(
    unique(new URL(request.url).searchParams),
  );
  if (params.resource !== mcpConfig().resource)
    return fail(
      "invalid_target",
      "The resource must be the mini-habitify MCP address.",
    );
  const state = randomToken(),
    browser = randomToken(),
    verifier = randomToken();
  const client = await transaction(async (db) => {
    const { rows } = await db.query<{
      id: string;
      upstream_id: string;
      metadata: z.infer<typeof registrationSchema>;
    }>("select * from mcp_gateway.clients where id=$1", [params.client_id]);
    return rows[0]?.metadata.redirect_uris.includes(params.redirect_uri)
      ? rows[0]
      : null;
  });
  if (!client)
    return fail(
      "invalid_client",
      "Unknown client or callback. Reconnect your assistant.",
    );
  const upstream = new URL(`${supabaseConfig().url}/auth/v1/oauth/authorize`);
  upstream.search = new URLSearchParams({
    client_id: client.upstream_id,
    redirect_uri: `${mcpConfig().origin}/oauth/mcp/callback`,
    response_type: "code",
    scope: "email",
    state,
    code_challenge: Buffer.from(digest(verifier), "hex").toString("base64url"),
    code_challenge_method: "S256",
    resource: mcpConfig().resource,
    prompt: "consent",
  }).toString();
  const started = await fetch(upstream, {
    redirect: "manual",
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const consent = new URL(
    started.headers.get("location") || "",
    supabaseConfig().url,
  );
  if (
    ![302, 303].includes(started.status) ||
    consent.pathname !== "/oauth/consent"
  )
    throw new Error("Upstream consent unavailable.");
  const authorizationId = authorizationIdSchema.parse(
    consent.searchParams.get("authorization_id"),
  );
  await transaction(async (db) => {
    await db.query("delete from mcp_gateway.pending where expires_at<now()");
    await db.query("delete from mcp_gateway.grants where expires_at<now()");
    await db.query("delete from mcp_gateway.codes where expires_at<now()");
    await db.query(
      "delete from mcp_gateway.tokens where refresh_expires_at<now()",
    );
    await db.query(
      "insert into mcp_gateway.pending(state_hash,authorization_id,client_id,request,verifier,browser_hash) values($1,$2,$3,$4,$5,$6)",
      [
        digest(state),
        authorizationId,
        params.client_id,
        params,
        encrypt(verifier, gatewayKey()),
        digest(browser),
      ],
    );
  });
  return redirectTo(
    `${mcpConfig().origin}/oauth/consent?authorization_id=${authorizationId}`,
    cookie(state, browser, 600),
  );
}
function cookie(state: string, value: string, maxAge: number) {
  return `mh_oauth_${state.slice(0, 16)}=${value}; Path=/oauth/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${mcpConfig().origin.startsWith("https:") ? "; Secure" : ""}`;
}
async function callback(request: Request) {
  const query = unique(new URL(request.url).searchParams);
  const state = z
    .string()
    .regex(/^[A-Za-z0-9_-]{43}$/)
    .parse(query.state);
  const browser = request.headers
    .get("cookie")
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(`mh_oauth_${state.slice(0, 16)}=`))
    ?.split("=")[1];
  if (!browser)
    return fail(
      "invalid_request",
      "Connection browser session expired. Start again.",
    );
  return transaction(async (db) => {
    const { rows } = await db.query<{
      request: unknown;
      verifier: string;
      upstream_id: string;
    }>(
      `delete from mcp_gateway.pending p using mcp_gateway.clients c where p.client_id=c.id and p.state_hash=$1 and p.browser_hash=$2 and p.expires_at>now() returning p.request,p.verifier,c.upstream_id`,
      [digest(state), digest(browser)],
    );
    const pending = rows[0];
    if (!pending)
      return fail(
        "invalid_request",
        "Connection request expired or already used.",
      );
    const params = authorizationSchema.parse(pending.request);
    const destination = new URL(params.redirect_uri);
    destination.searchParams.set("state", params.state);
    destination.searchParams.set("iss", mcpConfig().origin);
    if (query.error) {
      destination.searchParams.set("error", "access_denied");
      return redirectTo(destination.href, cookie(state, "", 0));
    }
    const credentials = await exchangeUpstream({
      grant_type: "authorization_code",
      client_id: pending.upstream_id,
      redirect_uri: `${mcpConfig().origin}/oauth/mcp/callback`,
      code: z.string().min(1).max(2048).parse(query.code),
      code_verifier: z.string().parse(decrypt(pending.verifier, gatewayKey())),
    });
    const permission = await verifyUpstream(credentials);
    if (permission.clientId !== pending.upstream_id)
      throw new Error("Upstream client mismatch.");
    const grantId = crypto.randomUUID();
    await db.query(
      "insert into mcp_gateway.grants(id,user_id,client_id,upstream_client_id,upstream_grant_id,credentials) values($1,$2,$3,$4,$5,$6)",
      [
        grantId,
        permission.userId,
        params.client_id,
        pending.upstream_id,
        permission.grantId,
        encrypt(credentials, gatewayKey()),
      ],
    );
    const scope = params.scope
      .split(" ")
      .filter((s) => s !== "tracking:write" || permission.canWrite)
      .join(" ");
    const response = new OAuth.Response();
    await oauthServer(db).authorize(
      new OAuth.Request({
        method: "GET",
        headers: {},
        query: { ...params, scope },
        body: {},
      }),
      response,
      {
        authenticateHandler: {
          handle: async () => ({ id: permission.userId, grantId }),
        },
      },
    );
    const location = new URL(response.headers!.location);
    location.searchParams.set("iss", mcpConfig().origin);
    return redirectTo(location.href, cookie(state, "", 0));
  });
}
async function formBody(request: Request) {
  if (
    !request.headers
      .get("content-type")
      ?.startsWith("application/x-www-form-urlencoded")
  )
    throw new OAuth.InvalidRequestError("Send URL-encoded OAuth parameters.");
  return unique(new URLSearchParams(await readGatewayBody(request)));
}
async function token(request: Request) {
  const form = await formBody(request);
  if (form.resource !== mcpConfig().resource)
    return fail(
      "invalid_target",
      "The resource must match the mini-habitify MCP address.",
    );
  if (
    form.scope &&
    (!form.scope.split(" ").includes("tracking:read") ||
      !form.scope.split(" ").every((s) => gatewayScopes.includes(s)))
  )
    return fail(
      "invalid_scope",
      "Only approved tracking scopes are supported.",
    );
  if (request.headers.has("authorization") || form.client_secret)
    return fail("invalid_client", "Only public PKCE clients are supported.");
  if (
    form.grant_type !== "authorization_code" &&
    form.grant_type !== "refresh_token"
  )
    return fail(
      "unsupported_grant_type",
      "Only authorization_code and refresh_token are supported.",
    );
  return transaction(async (db) => {
    const response = new OAuth.Response();
    try {
      await oauthServer(db).token(
        new OAuth.Request({
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded",
            "content-length": String(
              Buffer.byteLength(new URLSearchParams(form).toString()),
            ),
          },
          query: {},
          body: form,
        }),
        response,
      );
      return Response.json(response.body, {
        status: response.status || 200,
        headers: privateHeaders,
      });
    } catch (error) {
      // Commit consumed codes/refresh tokens even on invalid PKCE; no replay.
      if (error instanceof OAuth.OAuthError && error.code < 500)
        return fail(error.name, error.message, error.code);
      throw error;
    }
  });
}
async function revoke(request: Request) {
  const form = await formBody(request);
  const parsed = z
    .object({ client_id: z.uuid(), token: z.string().min(1).max(2048) })
    .parse(form);
  await transaction(async (db) => {
    // No token existence disclosure. Revokes the complete gateway grant.
    await db.query(
      `delete from mcp_gateway.grants g using mcp_gateway.tokens t where t.grant_id=g.id and g.client_id=$1 and (t.access_hash=$2 or t.refresh_hash=$2)`,
      [parsed.client_id, digest(parsed.token)],
    );
  });
  return new Response(null, { status: 200, headers: privateHeaders });
}
