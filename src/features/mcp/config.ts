import { supabaseConfig } from "@/lib/supabase/config";
export function mcpConfig() {
  const app = new URL(
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  );
  if (
    app.protocol !== "https:" &&
    !["localhost", "127.0.0.1"].includes(app.hostname)
  )
    throw new Error("MCP requires an HTTPS application URL.");
  return {
    resource: new URL("/mcp", app).href,
    metadata: new URL("/.well-known/oauth-protected-resource/mcp", app).href,
    issuer: `${supabaseConfig().url}/auth/v1`,
    origin: app.origin,
  };
}
export function allowedMcpOrigin(origin: string | null) {
  if (!origin) return true; // Native/server clients do not send an Origin header.
  return [
    mcpConfig().origin,
    ...(process.env.MCP_ALLOWED_ORIGINS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  ].includes(origin);
}
