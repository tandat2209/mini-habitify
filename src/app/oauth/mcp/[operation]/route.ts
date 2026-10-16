import { handleGateway } from "@/features/mcp/gateway/handlers";
import { allowedMcpOrigin } from "@/features/mcp/config";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function cors(request: Request, response: Response) {
  const origin = request.headers.get("origin");
  if (origin && allowedMcpOrigin(origin))
    response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Vary", "Origin");
  return response;
}
async function handle(
  request: Request,
  { params }: { params: Promise<{ operation: string }> },
) {
  const { operation } = await params;
  if (!allowedMcpOrigin(request.headers.get("origin")))
    return new Response(null, { status: 403 });
  if (
    (request.method === "GET" &&
      (operation === "authorize" || operation === "callback")) ||
    (request.method === "POST" &&
      (operation === "register" ||
        operation === "token" ||
        operation === "revoke"))
  )
    return cors(
      request,
      await handleGateway(
        request,
        operation as "register" | "authorize" | "callback" | "token" | "revoke",
      ),
    );
  return new Response(null, {
    status: 405,
    headers: {
      Allow: ["authorize", "callback"].includes(operation) ? "GET" : "POST",
    },
  });
}
export const GET = handle;
export const POST = handle;
export function OPTIONS(request: Request) {
  if (!allowedMcpOrigin(request.headers.get("origin")))
    return new Response(null, { status: 403 });
  return cors(
    request,
    new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Cache-Control": "no-store",
      },
    }),
  );
}
