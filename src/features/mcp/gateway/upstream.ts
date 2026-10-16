import "server-only";
import OAuth from "@node-oauth/oauth2-server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/lib/database.types";
import { supabaseConfig } from "@/lib/supabase/config";
import { mcpConfig } from "../config";
import { validMcpClaims } from "../security";
export const credentialSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_at: z.number(),
});
export type Credentials = z.infer<typeof credentialSchema>;
export async function exchangeUpstream(
  body: Record<string, string>,
): Promise<Credentials> {
  const { url, key } = supabaseConfig();
  const response = await fetch(`${url}/auth/v1/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      apikey: key,
    },
    body: new URLSearchParams(body),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
    redirect: "error",
  });
  if ([400, 401, 403].includes(response.status))
    throw new OAuth.InvalidGrantError(
      "Connection expired or revoked. Reconnect.",
    );
  if (!response.ok) throw new Error("Upstream authorization failed.");
  const result = z
    .object({
      access_token: z.string(),
      refresh_token: z.string(),
      expires_in: z.number().positive(),
      id_token: z.never().optional(),
    })
    .parse(await response.json());
  return {
    access_token: result.access_token,
    refresh_token: result.refresh_token,
    expires_at: Date.now() + result.expires_in * 1000,
  };
}
export async function verifyUpstream(credentials: Credentials) {
  const { url, key } = supabaseConfig();
  const verifier = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await verifier.auth.getClaims(
    credentials.access_token,
  );
  const config = mcpConfig();
  if (error) throw new Error("Authorization temporarily unavailable.");
  if (!data || !validMcpClaims(data.claims, config.issuer, config.resource))
    throw new OAuth.InvalidGrantError("Invalid upstream authorization.");
  const client = createClient<Database>(url, key, {
    accessToken: async () => credentials.access_token,
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const read = await client.rpc("mcp_permission", { p_write: false });
  const write = await client.rpc("mcp_permission", { p_write: true });
  if (read.error || write.error)
    throw new Error("Authorization temporarily unavailable.");
  if (!read.data) throw new OAuth.InvalidGrantError("Connection revoked.");
  return {
    userId: data.claims.sub,
    clientId: String(data.claims.client_id),
    grantId: String(data.claims.mcp_grant_id),
    canWrite: write.data,
  };
}
