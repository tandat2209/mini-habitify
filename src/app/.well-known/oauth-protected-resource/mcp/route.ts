import { mcpConfig } from "@/features/mcp/config";
export function GET() {
  const { resource, issuer } = mcpConfig();
  return Response.json(
    {
      resource,
      resource_name: "mini-habitify",
      authorization_servers: [issuer],
      scopes_supported: ["email"],
      bearer_methods_supported: ["header"],
    },
    {
      headers: {
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}
