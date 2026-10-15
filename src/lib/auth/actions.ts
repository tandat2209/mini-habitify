"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { consentReturnPath } from "@/features/mcp/security";
import { authSchema } from "@/features/trackers/validation";
export interface AuthState {
  error?: string;
  message?: string;
}
export async function authenticate(
  mode: "login" | "signup",
  _previous: AuthState,
  data: FormData,
): Promise<AuthState> {
  const input = authSchema.safeParse({
    email: data.get("email"),
    password: data.get("password"),
    timezone: data.get("timezone") || "UTC",
  });
  if (!input.success) return { error: input.error.issues[0].message };
  const client = await createClient();
  if (mode === "signup") {
    const { error, data: result } = await client.auth.signUp({
      email: input.data.email,
      password: input.data.password,
      options: { data: { timezone: input.data.timezone } },
    });
    if (error) return { error: error.message };
    if (!result.session)
      return {
        message: "Check your email to confirm your account, then sign in.",
      };
  } else {
    const { error } = await client.auth.signInWithPassword({
      email: input.data.email,
      password: input.data.password,
    });
    if (error)
      return { error: "Could not sign in. Check your email and password." };
  }
  redirect(consentReturnPath(data.get("authorization_id")));
}
export async function signOut() {
  const client = await createClient();
  const { error } = await client.auth.signOut();
  if (error) throw new Error("Could not sign out. Please try again.");
  redirect("/login");
}
