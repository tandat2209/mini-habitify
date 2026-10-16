import { mcpConfig } from "@/features/mcp/config";
import { gatewayEnabled } from "@/features/mcp/gateway/store";
import { gatewayScopes } from "@/features/mcp/gateway/security";
export function GET() {
  const { resource, issuer } = mcpConfig();
  return Response.json(
    {
      resource,
      resource_name: "mini-habitify",
      authorization_servers: [gatewayEnabled() ? mcpConfig().origin : issuer],
      scopes_supported: gatewayEnabled() ? gatewayScopes : ["email"],
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
