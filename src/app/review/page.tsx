import { loadReview } from "@/features/review/queries";
import { WeeklyReview } from "@/components/review/weekly-review";

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string | string[] }>;
}) {
  const { week } = await searchParams;
  const data = await loadReview(typeof week === "string" ? week : undefined);
  return <WeeklyReview data={data} />;
}
