"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { authorizationIdSchema, supportedMcpScope } from "./security";
import { mcpConfig } from "./config";
export interface ConnectionState {
  error?: string;
}
export async function decideConnection(
  authorizationId: string,
  _state: ConnectionState,
  form: FormData,
): Promise<ConnectionState> {
  if (!authorizationIdSchema.safeParse(authorizationId).success)
    return { error: "Invalid connection request." };
  const { client, user } = await requireSession();
  const details =
    await client.auth.oauth.getAuthorizationDetails(authorizationId);
  if (details.error || !details.data)
    return {
      error: "This connection request expired. Start again in your assistant.",
    };
  if ("redirect_url" in details.data) redirect(details.data.redirect_url);
  if (form.get("decision") !== "allow") {
    const denied = await client.auth.oauth.denyAuthorization(authorizationId, {
      skipBrowserRedirect: true,
    });
    if (denied.error || !denied.data)
      return { error: "Could not decline the request. Please try again." };
    redirect(denied.data.redirect_url);
  }
  if (!supportedMcpScope(details.data.scope))
    return {
      error:
        "This connection requires the email OAuth scope only. Remove openid and other scopes in your assistant and reconnect.",
    };
  const clientId = details.data.client.id;
  const grantId = crypto.randomUUID();
  const saved = await client.from("mcp_connections").upsert({
    user_id: user.id,
    client_id: clientId,
    client_name: details.data.client.name.slice(0, 200) || "Unnamed app",
    resource: mcpConfig().resource,
    grant_id: grantId,
    can_write: form.get("can_write") === "on",
    revoked_at: null,
    created_at: new Date().toISOString(),
  });
  if (saved.error)
    return { error: "Could not save permissions. No access was granted." };
  const approved = await client.auth.oauth.approveAuthorization(
    authorizationId,
    { skipBrowserRedirect: true },
  );
  if (approved.error || !approved.data) {
    await client
      .from("mcp_connections")
      .update({ revoked_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("client_id", clientId)
      .eq("grant_id", grantId);
    return {
      error: "Could not finish connecting. Start again in your assistant.",
    };
  }
  revalidatePath("/settings/connections");
  redirect(approved.data.redirect_url);
}
export async function disconnectApp(
  clientId: string,
): Promise<ConnectionState> {
  if (!z.uuid().safeParse(clientId).success)
    return { error: "Invalid connected app." };
  const { client, user } = await requireSession();
  // Block issued tokens first; native revocation also invalidates refresh tokens.
  const local = await client
    .from("mcp_connections")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("client_id", clientId);
  if (local.error) return { error: "Could not disconnect. Please try again." };
  const revoked = await client.auth.oauth.revokeGrant({ clientId });
  revalidatePath("/settings/connections");
  return revoked.error
    ? {
        error:
          "Tracking access is blocked. Retry disconnecting to also remove the OAuth grant.",
      }
    : {};
}
