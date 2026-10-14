import { Skeleton } from "@/components/ui/skeleton";
export default function Loading() {
  return (
    <main className="main" aria-label="Loading your trackers">
      <Skeleton className="h-12 w-64 mb-8" />
      <Skeleton className="h-28 w-full mb-8" />
      <div className="tracker-grid">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-64" />
        ))}
      </div>
    </main>
  );
}
