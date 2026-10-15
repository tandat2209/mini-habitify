"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  passwordResetSchema,
  recoveryEmailSchema,
} from "@/features/trackers/validation";
import type { AuthState } from "./actions";
export async function requestPasswordReset(
  _previous: AuthState,
  form: FormData,
): Promise<AuthState> {
  const parsed = recoveryEmailSchema.safeParse({ email: form.get("email") });
  if (!parsed.success) return { error: "Enter a valid email address." };
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "");
  if (!appUrl)
    return {
      error:
        "Account recovery is not configured. Please contact the app owner.",
    };
  const client = await createClient();
  const { error } = await client.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: new URL("/auth/callback", appUrl).toString(),
  });
  if (error)
    return {
      error: "We couldn’t send a reset link. Please try again shortly.",
    };
  return {
    message: "If an account uses this email, a reset link is on its way.",
  };
}
export async function updateRecoveredPassword(
  _previous: AuthState,
  form: FormData,
): Promise<AuthState> {
  const parsed = passwordResetSchema.safeParse({
    password: form.get("password"),
    confirm_password: form.get("confirm_password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const client = await createClient();
  const { data, error: sessionError } = await client.auth.getUser();
  if (sessionError || !data.user)
    return {
      error: "This reset session has expired. Please request a fresh link.",
    };
  const { error } = await client.auth.updateUser({
    password: parsed.data.password,
  });
  if (error)
    return {
      error:
        "Could not update your password. Try a different password or request a fresh link.",
    };
  const { error: signOutError } = await client.auth.signOut({
    scope: "global",
  });
  if (signOutError)
    return {
      message:
        "Your password was updated. Please sign out and sign in with your new password.",
    };
  redirect("/login?password=updated");
}
