import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { RecoveryForm } from "@/components/shell/recovery-form";
import { Button } from "@/components/ui/button";
export default async function ResetPassword() {
  const client = await createClient();
  const { data } = await client.auth.getUser();
  if (!data.user)
    return (
      <main className="recovery-page">
        <section className="panel recovery-card">
          <h1>Request a fresh reset link.</h1>
          <p className="muted mb-6">
            Your password reset link is missing or has expired.
          </p>
          <Button asChild>
            <Link href="/forgot-password">Send a fresh link</Link>
          </Button>
        </section>
      </main>
    );
  return <RecoveryForm mode="update" />;
}
