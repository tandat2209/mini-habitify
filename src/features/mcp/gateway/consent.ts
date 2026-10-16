import "server-only";
import { cookies } from "next/headers";
import { authorizationSchema, digest } from "./security";
import { gatewayEnabled, transaction } from "./store";
// Native consent stays authoritative. This lookup adds the real assistant's
// callback and requested tracking scopes, bound to this browser and request.
export async function gatewayConsent(
  clientId: string,
  authorizationId: string,
) {
  if (!gatewayEnabled()) return null;
  const jar = await cookies();
  return transaction(async (db) => {
    const client = await db.query(
      "select id from mcp_gateway.clients where upstream_id=$1",
      [clientId],
    );
    if (!client.rowCount) return null;
    const { rows } = await db.query<{ request: unknown; browser_hash: string }>(
      `select p.request,p.browser_hash from mcp_gateway.pending p join mcp_gateway.clients c on c.id=p.client_id where c.upstream_id=$1 and p.authorization_id=$2 and p.expires_at>now()`,
      [clientId, authorizationId],
    );
    const row = rows[0];
    if (
      !row ||
      !jar
        .getAll()
        .some(
          (c) =>
            c.name.startsWith("mh_oauth_") &&
            digest(c.value) === row.browser_hash,
        )
    )
      throw new Error(
        "Gateway connection request expired. Start again from your assistant.",
      );
    const params = authorizationSchema.parse(row.request);
    return {
      redirectUri: params.redirect_uri,
      scope: params.scope,
      canWrite: params.scope.split(" ").includes("tracking:write"),
    };
  });
}
