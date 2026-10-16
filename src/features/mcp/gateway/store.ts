import "server-only";
import pg, { type PoolClient } from "pg";
import { gatewayDatabaseConfig } from "./database";
import { digest } from "./security";
let pool: pg.Pool | undefined;
export function gatewayEnabled() {
  return Boolean(
    process.env.MCP_GATEWAY_DATABASE_URL &&
    process.env.MCP_GATEWAY_ENCRYPTION_KEY,
  );
}
export function gatewayKey() {
  const key = process.env.MCP_GATEWAY_ENCRYPTION_KEY;
  if (!key) throw new Error("MCP gateway is not configured.");
  return key;
}
export async function transaction<T>(
  work: (db: PoolClient) => Promise<T>,
): Promise<T> {
  if (!gatewayEnabled()) throw new Error("MCP gateway is not configured.");
  pool ??= new pg.Pool({
    ...gatewayDatabaseConfig(process.env.MCP_GATEWAY_DATABASE_URL!),
    max: 3,
    idleTimeoutMillis: 20000,
    connectionTimeoutMillis: 5000,
  });
  const db = await pool.connect();
  try {
    await db.query("begin");
    // This role has access only to private OAuth storage, never tracking tables.
    await db.query("set local role mcp_gateway");
    const value = await work(db);
    await db.query("commit");
    return value;
  } catch (error) {
    await db.query("rollback");
    throw error;
  } finally {
    db.release();
  }
}
export async function rateLimit(request: Request, kind: string) {
  // Vercel overwrites this header; local requests share a conservative bucket.
  const ip = request.headers.get("x-vercel-forwarded-for") || "local";
  return transaction(async (db) => {
    await db.query(
      "delete from mcp_gateway.limits where window_start<now()-interval '1 hour'",
    );
    const { rows } = await db.query<{ requests: number }>(
      `insert into mcp_gateway.limits as l(key,window_start,requests) values($1,date_trunc('minute',now()),1)
      on conflict(key) do update set requests=case when l.window_start=date_trunc('minute',now()) then l.requests+1 else 1 end,window_start=date_trunc('minute',now()) returning requests`,
      [digest(`${kind}:${ip}`)],
    );
    return rows[0].requests <= 30;
  });
}
