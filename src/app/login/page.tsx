import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthForm } from "@/components/shell/auth-form";
import { consentReturnPath } from "@/features/mcp/security";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ authorization_id?: string }>;
}) {
  const { authorization_id } = await searchParams;
  const client = await createClient();
  const { data } = await client.auth.getUser();
  if (data.user) redirect(consentReturnPath(authorization_id));
  return <AuthForm mode="login" authorizationId={authorization_id} />;
}
