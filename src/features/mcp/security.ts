import { z } from "zod";
export function validMcpClaims(
  claims: Record<string, unknown>,
  issuer: string,
  resource: string,
  now = Date.now() / 1000,
) {
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  return (
    claims.iss === issuer &&
    audience.includes(resource) &&
    claims.role === "authenticated" &&
    claims.session_id === claims.mcp_grant_id &&
    z.uuid().safeParse(claims.sub).success &&
    z.uuid().safeParse(claims.client_id).success &&
    z.uuid().safeParse(claims.mcp_grant_id).success &&
    typeof claims.exp === "number" &&
    claims.exp > now
  );
}
export const authorizationIdSchema = z.string().regex(/^[a-zA-Z0-9]{32}$/);
export function consentReturnPath(id: unknown) {
  return authorizationIdSchema.safeParse(id).success
    ? `/oauth/consent?authorization_id=${id}`
    : "/today";
}

export function supportedMcpScope(scope: string) {
  return scope.trim() === "email";
}
