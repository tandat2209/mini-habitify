import { z } from "zod";
import { mcpConfig } from "@/features/mcp/config";
import { authorizationIdSchema } from "@/features/mcp/security";
import { readGatewayBody } from "@/features/mcp/gateway/handlers";
import { decideConnection } from "@/features/mcp/actions";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  if (request.headers.get("origin") !== mcpConfig().origin)
    return Response.json(
      { error: "Invalid request origin." },
      { status: 403, headers },
    );
  if (Number(request.headers.get("content-length")) > 4096)
    return Response.json(
      { error: "Request too large." },
      { status: 413, headers },
    );
  let value: unknown;
  try {
    value = JSON.parse(await readGatewayBody(request));
  } catch {
    return Response.json(
      { error: "Invalid connection request." },
      { status: 400, headers },
    );
  }
  const input = z
    .object({
      authorizationId: authorizationIdSchema,
      decision: z.enum(["allow", "deny"]),
      canWrite: z.boolean(),
    })
    .safeParse(value);
  if (!input.success)
    return Response.json(
      { error: "Invalid connection request." },
      { status: 400, headers },
    );
  const form = new FormData();
  form.set("decision", input.data.decision);
  if (input.data.canWrite) form.set("can_write", "on");
  return Response.json(
    await decideConnection(input.data.authorizationId, {}, form),
    { headers },
  );
}
