import { RecoveryForm } from "@/components/shell/recovery-form";
export default async function ForgotPassword({
  searchParams,
}: {
  searchParams: Promise<{ link?: string }>;
}) {
  const { link } = await searchParams;
  return (
    <RecoveryForm
      mode="request"
      notice={
        link === "expired"
          ? "Your reset link has expired or was already used. Request a fresh one below."
          : undefined
      }
    />
  );
}
