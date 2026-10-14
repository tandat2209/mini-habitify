import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthForm } from "@/components/shell/auth-form";
export default async function Login() {
  const client = await createClient();
  const { data } = await client.auth.getUser();
  if (data.user) redirect("/today");
  return <AuthForm mode="login" />;
}
