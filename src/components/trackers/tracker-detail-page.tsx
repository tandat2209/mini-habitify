"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type {
  ActivityTracker,
  ActivityLog,
  TemplateData,
} from "@/features/activity-templates/types";
import type { Preferences } from "@/features/trackers/validation";
import { HistoryContent } from "./history-content";
import { TrackerForm } from "./tracker-form";
import { AppearanceScope } from "@/components/appearance/appearance-scope";
import { Brand } from "@/components/shell/brand";
import { Button } from "@/components/ui/button";
export function TrackerDetailPage({
  tracker,
  logs,
  today,
  preferences,
  templateData,
}: {
  tracker: ActivityTracker;
  logs: ActivityLog[];
  templateData: TemplateData;
  today: string;
  preferences: Preferences;
}) {
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  return (
    <AppearanceScope
      theme={preferences.theme}
      primaryColor={preferences.primary_color}
      presentation={preferences.presentation}
    >
      <header className="detail-header">
        <Brand />
        <Button asChild variant="ghost">
          <Link href="/today">
            <ArrowLeft data-icon="inline-start" />
            Back to Today
          </Link>
        </Button>
      </header>
      <main className="detail-page">
        <p className="eyebrow">Your everyday, over time</p>
        <h1>{tracker.name}</h1>
        <p className="muted mb-6">
          {tracker.archived_at
            ? "Archived · history preserved"
            : tracker.description ||
              `${tracker.type} · ${tracker.goal_period} goal`}
        </p>
        <section className="panel">
          <HistoryContent
            tracker={tracker}
            templateData={templateData}
            logs={logs}
            today={today}
            onClose={() => router.push("/today")}
            onEdit={() => setEdit(true)}
          />
        </section>
      </main>
      {edit && (
        <TrackerForm
          open
          tracker={tracker}
          templates={templateData.templates}
          theme={preferences.theme}
          onOpenChange={setEdit}
        />
      )}
    </AppearanceScope>
  );
}
