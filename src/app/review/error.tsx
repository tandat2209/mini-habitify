"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function ReviewError({ reset }: { reset: () => void }) {
  return (
    <main className="review-page">
      <h1>Your review needs a moment.</h1>
      <p className="muted mb-6">
        We couldn’t load your weekly activity. Please try again.
      </p>
      <div className="flex gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button asChild variant="outline">
          <Link href="/today">Back to Today</Link>
        </Button>
      </div>
    </main>
  );
}
