import "server-only";
import OAuth from "@node-oauth/oauth2-server";
import type { PoolClient } from "pg";
import { z } from "zod";
import {
  digest,
  randomToken,
  encrypt,
  decrypt,
  gatewayScopes,
} from "./security";
import { gatewayKey, transaction } from "./store";
import { credentialSchema, exchangeUpstream, verifyUpstream } from "./upstream";
interface GrantRow {
  id: string;
  user_id: string;
  client_id: string;
  upstream_client_id: string;
  upstream_grant_id: string;
  credentials: string;
  expires_at: Date;
}
interface ClientRow {
  id: string;
  upstream_id: string;
  metadata: { redirect_uris: string[] };
}
interface CodeRow extends GrantRow {
  hash: string;
  redirect_uri: string;
  challenge: string;
  scope: string[];
  code_expires_at: Date;
  metadata: ClientRow["metadata"];
}
interface TokenRow extends GrantRow {
  access_hash: string;
  refresh_hash: string;
  scope: string[];
  access_expires_at: Date;
  refresh_expires_at: Date;
  refresh_used_at: Date | null;
  metadata: ClientRow["metadata"];
}
const userSchema = z.object({ id: z.uuid(), grantId: z.uuid() });
export function oauthClient(
  row: Pick<ClientRow, "id" | "metadata">,
): OAuth.Client {
  return {
    id: row.id,
    redirectUris: row.metadata.redirect_uris,
    grants: ["authorization_code", "refresh_token"],
  };
}
export async function usableCredentials(db: PoolClient, grant: GrantRow) {
  if (grant.expires_at.getTime() <= Date.now())
    throw new OAuth.InvalidGrantError("Connection expired. Reconnect.");
  let credentials = credentialSchema.parse(
    decrypt(grant.credentials, gatewayKey()),
  );
  if (credentials.expires_at < Date.now() + 60000) {
    credentials = await exchangeUpstream({
      grant_type: "refresh_token",
      client_id: grant.upstream_client_id,
      refresh_token: credentials.refresh_token,
    });
    await db.query("update mcp_gateway.grants set credentials=$1 where id=$2", [
      encrypt(credentials, gatewayKey()),
      grant.id,
    ]);
  }
  const permission = await verifyUpstream(credentials);
  if (
    permission.userId !== grant.user_id ||
    permission.clientId !== grant.upstream_client_id ||
    permission.grantId !== grant.upstream_grant_id
  )
    throw new OAuth.InvalidGrantError("Connection no longer active.");
  return { credentials, permission };
}
export function oauthServer(db: PoolClient) {
  const model: OAuth.AuthorizationCodeModel & OAuth.RefreshTokenModel = {
    async getClient(id, secret) {
      if (secret || !z.uuid().safeParse(id).success) return false;
      const { rows } = await db.query<ClientRow>(
        "select * from mcp_gateway.clients where id=$1",
        [id],
      );
      return rows[0] ? oauthClient(rows[0]) : false;
    },
    async generateAccessToken() {
      return `mh_a_${randomToken()}`;
    },
    async generateRefreshToken() {
      return `mh_r_${randomToken()}`;
    },
    async generateAuthorizationCode() {
      return randomToken();
    },
    async saveAuthorizationCode(code, client, user) {
      const u = userSchema.parse(user);
      await db.query(
        "insert into mcp_gateway.codes(hash,grant_id,redirect_uri,challenge,scope,expires_at) values($1,$2,$3,$4,$5,$6)",
        [
          digest(code.authorizationCode),
          u.grantId,
          code.redirectUri,
          code.codeChallenge,
          code.scope,
          code.expiresAt,
        ],
      );
      return { ...code, client, user };
    },
    async getAuthorizationCode(code) {
      const { rows } = await db.query<CodeRow>(
        `select g.*,c.hash,c.redirect_uri,c.challenge,c.scope,c.expires_at as code_expires_at,cl.metadata from mcp_gateway.codes c join mcp_gateway.grants g on g.id=c.grant_id join mcp_gateway.clients cl on cl.id=g.client_id where c.hash=$1 for update of c,g`,
        [digest(code)],
      );
      const r = rows[0];
      if (!r) return false;
      return {
        authorizationCode: code,
        expiresAt: r.code_expires_at,
        redirectUri: r.redirect_uri,
        scope: r.scope,
        codeChallenge: r.challenge,
        codeChallengeMethod: "S256",
        client: oauthClient({ id: r.client_id, metadata: r.metadata }),
        user: { id: r.user_id, grantId: r.id },
      };
    },
    async revokeAuthorizationCode(code) {
      const result = await db.query(
        "delete from mcp_gateway.codes where hash=$1",
        [digest(code.authorizationCode)],
      );
      return result.rowCount === 1;
    },
    async getAccessToken() {
      return false;
    }, // Resource verification uses resolveGatewayToken.
    async getRefreshToken(token) {
      const { rows } = await db.query<TokenRow>(
        `select g.*,t.refresh_hash,t.scope,t.refresh_expires_at,t.refresh_used_at,cl.metadata from mcp_gateway.tokens t join mcp_gateway.grants g on g.id=t.grant_id join mcp_gateway.clients cl on cl.id=g.client_id where t.refresh_hash=$1 for update of t,g`,
        [digest(token)],
      );
      const r = rows[0];
      if (!r || r.expires_at.getTime() <= Date.now()) return false;
      if (r.refresh_used_at) {
        await db.query("delete from mcp_gateway.grants where id=$1", [r.id]);
        return false;
      }
      return {
        refreshToken: token,
        refreshTokenExpiresAt: r.refresh_expires_at,
        scope: r.scope,
        client: oauthClient({ id: r.client_id, metadata: r.metadata }),
        user: { id: r.user_id, grantId: r.id },
      };
    },
    async revokeToken(token) {
      const result = await db.query(
        "update mcp_gateway.tokens set refresh_used_at=now() where refresh_hash=$1 and refresh_used_at is null",
        [digest(token.refreshToken)],
      );
      return result.rowCount === 1;
    },
    async validateScope(_user, _client, scope) {
      return scope?.includes("tracking:read") &&
        scope.every((s) => gatewayScopes.includes(s))
        ? scope
        : false;
    },
    async saveToken(token, client, user) {
      const u = userSchema.parse(user);
      const { rows } = await db.query<GrantRow>(
        "select * from mcp_gateway.grants where id=$1 and user_id=$2 and client_id=$3 for update",
        [u.grantId, u.id, client.id],
      );
      if (!rows[0]) throw new OAuth.InvalidGrantError("Connection revoked.");
      const { permission } = await usableCredentials(db, rows[0]);
      if (token.scope?.includes("tracking:write") && !permission.canWrite)
        throw new OAuth.InvalidScopeError("Write access was not approved.");
      const refreshExpires = new Date(
        Math.min(
          token.refreshTokenExpiresAt!.getTime(),
          rows[0].expires_at.getTime(),
        ),
      );
      await db.query(
        "insert into mcp_gateway.tokens(access_hash,refresh_hash,grant_id,scope,access_expires_at,refresh_expires_at) values($1,$2,$3,$4,$5,$6)",
        [
          digest(token.accessToken),
          digest(token.refreshToken!),
          u.grantId,
          token.scope,
          token.accessTokenExpiresAt,
          refreshExpires,
        ],
      );
      return {
        ...token,
        accessToken: String(token.accessToken),
        refreshTokenExpiresAt: refreshExpires,
        client,
        user,
      };
    },
  };
  return new OAuth({
    model,
    requirePKCE: true,
    accessTokenLifetime: 3600,
    refreshTokenLifetime: 30 * 86400,
    authorizationCodeLifetime: 120,
    requireClientAuthentication: {
      authorization_code: false,
      refresh_token: false,
    },
    alwaysIssueNewRefreshToken: true,
  });
}
export async function resolveGatewayToken(token: string) {
  if (!/^mh_a_[A-Za-z0-9_-]{43}$/.test(token)) return null;
  return transaction(async (db) => {
    const { rows } = await db.query<TokenRow>(
      `select g.*,t.scope,t.access_expires_at from mcp_gateway.tokens t join mcp_gateway.grants g on g.id=t.grant_id where t.access_hash=$1 and t.access_expires_at>now() and t.refresh_used_at is null for update of g`,
      [digest(token)],
    );
    const row = rows[0];
    if (!row) return null;
    try {
      const { credentials, permission } = await usableCredentials(db, row);
      return {
        accessToken: credentials.access_token,
        canWrite: permission.canWrite && row.scope.includes("tracking:write"),
      };
    } catch (error) {
      if (!(error instanceof OAuth.InvalidGrantError)) throw error;
      await db.query("delete from mcp_gateway.grants where id=$1", [row.id]);
      return null;
    }
  });
}
