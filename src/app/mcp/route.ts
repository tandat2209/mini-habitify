import { createClient } from "@supabase/supabase-js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { Database } from "@/lib/database.types";
import { supabaseConfig } from "@/lib/supabase/config";
import { mcpConfig, allowedMcpOrigin } from "@/features/mcp/config";
import { validMcpClaims } from "@/features/mcp/security";
import { createMcpServer } from "@/features/mcp/server";
import { gatewayEnabled } from "@/features/mcp/gateway/store";
import { resolveGatewayToken } from "@/features/mcp/gateway/model";
import { gatewayScopes } from "@/features/mcp/gateway/security";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function headers(request: Request) {
  const h = new Headers({
    "Cache-Control": "private, no-store",
    Vary: "Origin",
  });
  const origin = request.headers.get("origin");
  if (origin && allowedMcpOrigin(origin))
    h.set("Access-Control-Allow-Origin", origin);
  h.set("Access-Control-Expose-Headers", "WWW-Authenticate, Retry-After");
  return h;
}
async function handle(request: Request) {
  const h = headers(request);
  if (!allowedMcpOrigin(request.headers.get("origin")))
    return Response.json(
      { error: "Origin not allowed." },
      { status: 403, headers: h },
    );
  const config = mcpConfig();
  const match = request.headers
    .get("authorization")
    ?.match(/^Bearer ([^\s]+)$/i);
  const unauthorized = () => {
    h.set(
      "WWW-Authenticate",
      `Bearer resource_metadata="${config.metadata}", scope="${gatewayEnabled() ? gatewayScopes.join(" ") : "email"}"`,
    );
    return Response.json(
      { error: "Connect using OAuth to access mini-habitify." },
      { status: 401, headers: h },
    );
  };
  if (!match) return unauthorized();
  let gateway: { accessToken: string; canWrite: boolean } | null = null;
  if (match[1].startsWith("mh_")) {
    if (!gatewayEnabled()) return unauthorized();
    try {
      gateway = await resolveGatewayToken(match[1]);
    } catch {
      return Response.json(
        { error: "Authorization is temporarily unavailable." },
        { status: 503, headers: h },
      );
    }
    if (!gateway) return unauthorized();
  }
  const accessToken = gateway?.accessToken ?? match[1];
  const { url, key } = supabaseConfig();
  const client = createClient<Database>(url, key, {
    accessToken: async () => accessToken,
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // Separate verifier: accessToken-mode clients deliberately disable auth APIs.
  const verifier = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await verifier.auth.getClaims(accessToken);
  if (
    error ||
    !data ||
    !validMcpClaims(data.claims, config.issuer, config.resource)
  )
    return unauthorized();
  const permission = await client.rpc("mcp_permission", { p_write: false });
  if (permission.error)
    return Response.json(
      { error: "Authorization is temporarily unavailable." },
      { status: 503, headers: h },
    );
  if (!permission.data)
    return Response.json(
      { error: "Connection revoked. Reconnect to continue." },
      { status: 403, headers: h },
    );
  if (request.method !== "POST")
    return new Response(null, {
      status: 405,
      headers: { ...Object.fromEntries(h), Allow: "POST, OPTIONS" },
    });
  const limit = await client.rpc("consume_mcp_request");
  if (limit.error)
    return Response.json(
      { error: "Request limiter unavailable." },
      { status: 503, headers: h },
    );
  if (!limit.data) {
    h.set("Retry-After", "60");
    return Response.json(
      { error: "Too many requests. Try again shortly." },
      { status: 429, headers: h },
    );
  }
  const write = await client.rpc("mcp_permission", { p_write: true });
  if (write.error)
    return Response.json(
      { error: "Authorization is temporarily unavailable." },
      { status: 503, headers: h },
    );
  const server = createMcpServer(
    { client, user: { id: data.claims.sub } },
    write.data && (gateway?.canWrite ?? true),
  );
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
    maxRequestBodySize: 65536,
  });
  await server.connect(transport);
  try {
    const response = await transport.handleRequest(request);
    h.forEach((value, name) => response.headers.set(name, value));
    return response;
  } finally {
    await server.close();
  }
}
export const POST = handle;
export const GET = handle;
export const DELETE = handle;
export async function OPTIONS(request: Request) {
  if (!allowedMcpOrigin(request.headers.get("origin")))
    return new Response(null, { status: 403 });
  const h = headers(request);
  h.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  h.set(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type, Accept, MCP-Protocol-Version, MCP-Session-Id",
  );
  return new Response(null, { status: 204, headers: h });
}
