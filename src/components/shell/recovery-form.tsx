"use client";
import { useActionState } from "react";
import Link from "next/link";
import {
  requestPasswordReset,
  updateRecoveredPassword,
} from "@/lib/auth/recovery-actions";
import { Brand } from "./brand";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
export function RecoveryForm({
  mode,
  notice,
}: {
  mode: "request" | "update";
  notice?: string;
}) {
  const [state, action, pending] = useActionState(
    mode === "request" ? requestPasswordReset : updateRecoveredPassword,
    {},
  );
  return (
    <main className="recovery-page">
      <Brand />
      <section className="panel recovery-card">
        <p className="eyebrow">Find your way back</p>
        <h1>
          {mode === "request"
            ? "A little help signing in."
            : "A fresh password."}
        </h1>
        <p className="muted mb-6">
          {mode === "request"
            ? "We’ll email you a link to reset your password."
            : "Choose a new password for your account. You’ll sign in again afterward."}
        </p>
        {notice && (
          <Alert className="mb-4">
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        )}
        <form action={action}>
          <FieldGroup>
            {mode === "request" ? (
              <Field>
                <FieldLabel htmlFor="recovery-email">Email address</FieldLabel>
                <Input
                  id="recovery-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                />
              </Field>
            ) : (
              <>
                <Field>
                  <FieldLabel htmlFor="new-password">New password</FieldLabel>
                  <Input
                    id="new-password"
                    name="password"
                    type="password"
                    minLength={8}
                    maxLength={128}
                    autoComplete="new-password"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="confirm-password">
                    Confirm password
                  </FieldLabel>
                  <Input
                    id="confirm-password"
                    name="confirm_password"
                    type="password"
                    minLength={8}
                    maxLength={128}
                    autoComplete="new-password"
                    required
                  />
                </Field>
              </>
            )}
            {state.error && (
              <Alert variant="destructive">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            )}
            {state.message && (
              <Alert>
                <AlertDescription>{state.message}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" disabled={pending}>
              {pending
                ? "One moment…"
                : mode === "request"
                  ? "Send reset link"
                  : "Update password"}
            </Button>
          </FieldGroup>
        </form>
        <p className="auth-link">
          <Link href="/login">Back to sign in</Link>
        </p>
      </section>
    </main>
  );
}
