import { AuthForm } from "@/components/shell/auth-form";
export default async function Signup({
  searchParams,
}: {
  searchParams: Promise<{ authorization_id?: string }>;
}) {
  const { authorization_id } = await searchParams;
  return <AuthForm mode="signup" authorizationId={authorization_id} />;
}
