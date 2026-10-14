"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="main">
      <h1 className="text-2xl mb-4">Your space needs a moment.</h1>
      <p className="muted mb-6">
        We couldn’t load your trackers. Please try again.
      </p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
