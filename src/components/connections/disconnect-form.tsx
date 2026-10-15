"use client";
import { useActionState } from "react";
import { disconnectApp } from "@/features/mcp/actions";
import { Button } from "@/components/ui/button";
export function DisconnectForm({
  clientId,
  name,
}: {
  clientId: string;
  name: string;
}) {
  const [state, action, pending] = useActionState(
    disconnectApp.bind(null, clientId),
    {},
  );
  return (
    <form action={action}>
      <Button
        variant="outline"
        disabled={pending}
        aria-label={`Disconnect ${name}`}
      >
        {pending ? "Disconnecting…" : "Disconnect"}
      </Button>
      {state.error && (
        <p role="alert" className="text-destructive mt-2">
          {state.error}
        </p>
      )}
    </form>
  );
}
