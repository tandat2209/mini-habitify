import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
export async function GET(request: NextRequest) {
  const token_hash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  if (
    token_hash &&
    (type === "signup" || type === "email" || type === "recovery")
  ) {
    const client = await createClient();
    const { error } = await client.auth.verifyOtp({
      token_hash,
      type: type as EmailOtpType,
    });
    if (!error)
      return NextResponse.redirect(
        new URL(
          type === "recovery" ? "/reset-password" : "/today",
          request.url,
        ),
      );
  }
  return NextResponse.redirect(
    new URL(
      type === "recovery"
        ? "/forgot-password?link=expired"
        : "/login?confirmation=failed",
      request.url,
    ),
  );
}
