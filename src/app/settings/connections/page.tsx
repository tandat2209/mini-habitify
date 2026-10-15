import Link from "next/link";
import { ArrowLeft, Cable, ExternalLink } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { AppearanceScope } from "@/components/appearance/appearance-scope";
import { Brand } from "@/components/shell/brand";
import { DisconnectForm } from "@/components/connections/disconnect-form";
import { Button } from "@/components/ui/button";
import { preferencesSchema } from "@/features/trackers/validation";
import { mcpConfig } from "@/features/mcp/config";
export default async function Connections() {
  const { client, user } = await requireSession();
  const [connections, grants, prefs] = await Promise.all([
    client.from("mcp_connections").select("*").eq("user_id", user.id),
    client.auth.oauth.listGrants(),
    client.from("user_preferences").select("*").eq("user_id", user.id).single(),
  ]);
  if (connections.error || prefs.error)
    throw new Error("Could not load connected apps.");
  const preference = preferencesSchema
    .pick({ theme: true, primary_color: true, presentation: true })
    .parse(prefs.data);
  const rows = new Map(
    connections.data
      .filter((c) => !c.revoked_at)
      .map((c) => [
        c.client_id,
        {
          id: c.client_id,
          name: c.client_name,
          canWrite: c.can_write,
          active: true,
          date: c.created_at,
        },
      ]),
  );
  for (const grant of grants.data ?? [])
    if (!rows.has(grant.client.id))
      rows.set(grant.client.id, {
        id: grant.client.id,
        name: grant.client.name || "Unnamed app",
        canWrite: false,
        active: false,
        date: grant.granted_at,
      });
  return (
    <AppearanceScope
      theme={preference.theme}
      primaryColor={preference.primary_color}
      presentation={preference.presentation}
    >
      <header className="detail-header">
        <Brand />
        <Button asChild variant="ghost">
          <Link href="/today">
            <ArrowLeft />
            Back to Today
          </Link>
        </Button>
      </header>
      <main className="detail-page connections-page">
        <p className="eyebrow">Your account, connected</p>
        <h1>Connected apps</h1>
        <p className="muted mt-3 mb-6">
          Let your assistant help with your everyday. You choose its permissions
          and can disconnect whenever you like.
        </p>
        <section className="panel mb-6">
          <Cable size={24} className="text-primary mb-3" aria-hidden />
          <h2>Connect an assistant</h2>
          <p className="muted my-3">
            Add this address as a remote MCP server in your assistant. Choose
            OAuth when asked, sign in, then review the permissions.
          </p>
          <label htmlFor="mcp-address" className="font-medium">
            MCP server address
          </label>
          <input
            id="mcp-address"
            className="connection-address"
            readOnly
            value={mcpConfig().resource}
          />
          <p className="muted text-sm mt-3">
            No API key needed. Your assistant must support remote MCP with
            OAuth. If asked for a scope, use “email”.
          </p>
        </section>
        <section className="panel">
          <h2 className="mb-4">Apps with access</h2>
          {grants.error && (
            <p role="alert" className="muted mb-4">
              OAuth connections aren’t available yet. The app owner needs to
              finish the OAuth server setup.
            </p>
          )}
          {rows.size === 0 ? (
            <p className="muted">No connected apps yet.</p>
          ) : (
            <div className="space-y-4">
              {[...rows.values()].map((row) => (
                <article key={row.id} className="connection-row">
                  <div>
                    <h3 className="font-semibold">{row.name}</h3>
                    <p className="muted text-sm">
                      {row.active
                        ? row.canWrite
                          ? "Read and manage tracking data"
                          : "Read tracking data"
                        : "Tracking access blocked · OAuth grant remains"}
                    </p>
                    <p className="muted text-xs mt-1">
                      Connected{" "}
                      {new Date(row.date).toLocaleDateString("en", {
                        dateStyle: "medium",
                        timeZone: "UTC",
                      })}
                    </p>
                  </div>
                  <DisconnectForm clientId={row.id} name={row.name} />
                </article>
              ))}
            </div>
          )}
        </section>
        <p className="muted text-sm mt-5">
          To change permissions, disconnect the app and reconnect.
        </p>
        <p className="muted text-sm mt-5 flex gap-2">
          <ExternalLink size={16} aria-hidden />
          Disconnecting blocks existing MCP tokens and revokes the app’s OAuth
          grant.
        </p>
      </main>
    </AppearanceScope>
  );
}
