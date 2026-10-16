// Local test/dev setup only. Does not contact hosted Supabase or reset data.
import { readFileSync, appendFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
process.loadEnvFile(".env.local");
const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
if (!["localhost", "127.0.0.1"].includes(url.hostname))
  throw new Error("This script only supports local Supabase.");
if (
  process.env.MCP_GATEWAY_DATABASE_URL ||
  process.env.MCP_GATEWAY_ENCRYPTION_KEY
) {
  if (
    !process.env.MCP_GATEWAY_DATABASE_URL ||
    !process.env.MCP_GATEWAY_ENCRYPTION_KEY
  )
    throw new Error("Configure both MCP gateway variables.");
  console.log("Local MCP gateway settings already present.");
} else {
  const project = readFileSync("supabase/config.toml", "utf8").match(
    /^project_id = "([a-zA-Z0-9_-]+)"/m,
  )?.[1];
  if (!project) throw new Error("Local project is missing.");
  const password = randomBytes(32).toString("hex");
  const result = spawnSync(
    "docker",
    [
      "exec",
      "-i",
      `supabase_db_${project}`,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-q",
    ],
    {
      input: `alter role mcp_gateway login password '${password}';\n`,
      encoding: "utf8",
    },
  );
  if (result.status !== 0)
    throw new Error(
      "Could not configure the local gateway role. Apply migrations first.",
    );
  const port = readFileSync("supabase/config.toml", "utf8").match(
    /\[db\][\s\S]*?\nport = (\d+)/,
  )?.[1];
  if (!port) throw new Error("Local database port is missing.");
  appendFileSync(
    ".env.local",
    `\nMCP_GATEWAY_DATABASE_URL=postgresql://mcp_gateway:${password}@127.0.0.1:${port}/postgres\nMCP_GATEWAY_ENCRYPTION_KEY=${randomBytes(32).toString("base64")}\n`,
    { mode: 0o600 },
  );
  console.log("Configured local-only MCP gateway credentials in .env.local.");
}
