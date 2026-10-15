"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowRight, Leaf, Check, Sparkles } from "lucide-react";
import { authenticate } from "@/lib/auth/actions";
import { Brand } from "./brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const [state, action, pending] = useActionState(
    authenticate.bind(null, mode),
    {},
  );
  const [timezone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  );
  const signup = mode === "signup";
  return (
    <main className="auth-page">
      <section className="auth-story">
        <Brand />
        <div>
          <p className="eyebrow">Your life. Your rhythm.</p>
          <h1>
            Small steps.
            <br />A life that’s
            <br />
            more you.
          </h1>
          <p>
            A quiet space for the things you want to make time for. Track your
            days, find your rhythm, make it yours.
          </p>
          <div className="auth-orbit" aria-hidden>
            <span>
              <Leaf size={42} />
            </span>
            <span>
              <Sparkles size={38} />
            </span>
            <span>
              <Check size={24} />
            </span>
          </div>
        </div>
        <small>Make your everyday yours.</small>
      </section>
      <section className="auth-form-side">
        <div className="auth-form">
          <p className="eyebrow">A fresh little start</p>
          <h2>{signup ? "Find your everyday." : "Welcome back."}</h2>
          <p className="muted">
            {signup
              ? "Create your space. Your first small step starts here."
              : "Your trackers and your progress are waiting for you."}
          </p>
          <form action={action}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email address</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  minLength={8}
                  maxLength={128}
                  autoComplete={signup ? "new-password" : "current-password"}
                  required
                  placeholder="At least 8 characters"
                />
              </Field>
              {signup && (
                <Field>
                  <FieldLabel htmlFor="timezone">Your timezone</FieldLabel>
                  <Input
                    id="timezone"
                    name="timezone"
                    defaultValue={timezone}
                    required
                  />
                  <p className="muted text-xs">
                    Keeps your daily check-ins on the right day.
                  </p>
                </Field>
              )}
              {!signup && <input type="hidden" name="timezone" value="UTC" />}
              {!signup && (
                <Link className="recovery-link" href="/forgot-password">
                  Forgot password?
                </Link>
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
                  : signup
                    ? "Create account"
                    : "Sign in"}
                <ArrowRight data-icon="inline-end" />
              </Button>
            </FieldGroup>
          </form>
          <p className="auth-link">
            {signup ? "Already have an account?" : "New around here?"}{" "}
            <Link href={signup ? "/login" : "/signup"}>
              {signup ? "Sign in" : "Create account"}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
