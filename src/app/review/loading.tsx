import { Skeleton } from "@/components/ui/skeleton";
export default function LoadingReview() {
  return (
    <main className="review-page" aria-label="Loading your weekly review">
      <Skeleton className="h-12 w-64 mb-8" />
      <Skeleton className="h-28 w-full mb-8" />
      <Skeleton className="h-64 w-full" />
    </main>
  );
}
