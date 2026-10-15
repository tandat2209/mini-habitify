import { redirect } from "next/navigation";
import Link from "next/link";
import { authorizationIdSchema } from "@/features/mcp/security";
import { createClient } from "@/lib/supabase/server";
import { ConsentForm } from "@/components/connections/consent-form";
import { Brand } from "@/components/shell/brand";
export default async function Consent({
  searchParams,
}: {
  searchParams: Promise<{ authorization_id?: string }>;
}) {
  const { authorization_id: id } = await searchParams;
  if (!authorizationIdSchema.safeParse(id).success)
    return (
      <main className="connection-page">
        <Brand />
        <h1>Invalid connection request</h1>
        <p>Start the connection again from your assistant.</p>
        <Link href="/today">Back to Today</Link>
      </main>
    );
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect(`/login?authorization_id=${id}`);
  const details = await client.auth.oauth.getAuthorizationDetails(id!);
  if (details.error || !details.data)
    return (
      <main className="connection-page">
        <Brand />
        <h1>Connection unavailable</h1>
        <p className="muted">
          This request may have expired. Start again from your assistant.
        </p>
        <Link href="/today">Back to Today</Link>
      </main>
    );
  if ("redirect_url" in details.data) redirect(details.data.redirect_url);
  return (
    <main className="connection-page">
      <Brand />
      <ConsentForm
        authorizationId={id!}
        name={details.data.client.name}
        redirectUri={details.data.redirect_uri}
        email={user.email ?? "Your account"}
        scope={details.data.scope}
      />
    </main>
  );
}
