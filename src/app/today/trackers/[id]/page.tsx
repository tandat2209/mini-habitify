import { notFound } from "next/navigation";
import { z } from "zod";
import { loadDashboard } from "@/features/dashboard/queries";
import { TrackerDetailPage } from "@/components/trackers/tracker-detail-page";
export default async function TrackerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const data = await loadDashboard();
  const tracker = data.trackers.find((t) => t.id === id);
  if (!tracker) notFound();
  return (
    <TrackerDetailPage
      tracker={tracker}
      templateData={{
        templates: data.templates,
        templateVersions: data.templateVersions,
      }}
      logs={data.logs.filter((l) => l.tracker_id === id)}
      today={data.today}
      preferences={data.preferences}
    />
  );
}
