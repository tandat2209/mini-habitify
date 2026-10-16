"use client";
import { useActionState, useEffect } from "react";
import { ShieldCheck, Eye, PencilLine } from "lucide-react";
import { supportedMcpScope } from "@/features/mcp/security";
import type { ConnectionState } from "@/features/mcp/actions";
import { Button } from "@/components/ui/button";
export function ConsentForm({
  authorizationId,
  name,
  redirectUri,
  email,
  scope,
  displayScope,
  canRequestWrite = true,
}: {
  authorizationId: string;
  name: string;
  redirectUri: string;
  email: string;
  scope: string;
  displayScope?: string;
  canRequestWrite?: boolean;
}) {
  const [state, action, pending] = useActionState(
    async (
      _previous: ConnectionState,
      form: FormData,
    ): Promise<ConnectionState> => {
      try {
        const response = await fetch("/oauth/mcp/decision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            authorizationId,
            decision: form.get("decision") || "deny",
            canWrite: form.get("can_write") === "on",
          }),
        });
        if (!response.ok)
          return {
            error:
              "Could not complete this request. Start again from your assistant.",
          };
        return (await response.json()) as ConnectionState;
      } catch {
        return { error: "Could not complete this request. Please try again." };
      }
    },
    {},
  );
  useEffect(() => {
    if (state.redirectUrl) window.location.assign(state.redirectUrl);
  }, [state.redirectUrl]);
  return (
    <section className="panel connection-consent">
      <ShieldCheck className="text-primary mb-4" size={32} aria-hidden />
      <p className="eyebrow">You’re in control</p>
      <h1>Connect your assistant</h1>
      <p className="muted mt-3">
        <strong className="text-foreground">{name}</strong> wants to connect to
        your mini-habitify account.
      </p>
      <div className="connection-permission">
        <Eye size={20} aria-hidden />
        <div>
          <strong>Read your tracking data</strong>
          <p className="muted">
            Trackers, check-ins, journal details, activity templates, and
            timezone.
          </p>
        </div>
      </div>
      {canRequestWrite && (
        <label className="connection-permission connection-write">
          <input type="checkbox" name="can_write" form="oauth-consent" />
          <PencilLine size={20} aria-hidden />
          <span>
            <strong>
              Allow creating and managing trackers, templates, and check-ins
            </strong>
            <span className="muted block">
              Optional. This permits tracker, template, and check-in changes
              through the assistant and API. Account and appearance settings
              remain private.
            </span>
          </span>
        </label>
      )}
      <p className="muted text-sm">
        Only connect apps you trust. App names are provided by their developers.
        You can disconnect at any time in Connected apps.
      </p>
      <details className="mt-4 text-sm">
        <summary>Connection details</summary>
        <dl className="mt-3 space-y-2 break-all">
          <div>
            <dt>Signed in as</dt>
            <dd className="muted">{email}</dd>
          </div>
          <div>
            <dt>Return address</dt>
            <dd className="muted">{redirectUri}</dd>
          </div>
          <div>
            <dt>Requested scopes</dt>
            <dd className="muted">{displayScope ?? (scope || "None")}</dd>
          </div>
        </dl>
      </details>
      {!supportedMcpScope(scope) && (
        <p role="alert" className="text-destructive mt-4">
          This assistant requested unsupported scopes. Configure its OAuth scope
          as “email” only and start again. OpenID identity tokens are not
          supported for MCP access.
        </p>
      )}
      <form
        id="oauth-consent"
        action={action}
        className="mt-6 flex flex-wrap gap-3"
      >
        {state.error && (
          <p role="alert" className="w-full text-destructive">
            {state.error}
          </p>
        )}
        <Button
          name="decision"
          value="deny"
          variant="outline"
          disabled={pending}
        >
          Decline
        </Button>
        <Button
          name="decision"
          value="allow"
          disabled={pending || !supportedMcpScope(scope)}
        >
          {pending ? "Connecting…" : "Allow access"}
        </Button>
      </form>
    </section>
  );
}
