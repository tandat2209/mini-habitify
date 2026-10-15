import "server-only";
import { requireSession } from "@/lib/auth/session";
import { dateInTimezone } from "@/features/tracker-engine/engine";
import { loadTemplateData } from "@/features/activity-templates/queries";
import type {
  ActivityLog,
  ActivityTracker,
} from "@/features/activity-templates/types";
import { validateDetails } from "@/features/activity-templates/validation";
import { preferencesSchema } from "@/features/trackers/validation";
export async function loadDashboard() {
  const { client, user } = await requireSession();
  const [profile, trackers, preferences, widgets] = await Promise.all([
    client.from("profiles").select("timezone").eq("id", user.id).single(),
    client
      .from("trackers")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    client.from("user_preferences").select("*").eq("user_id", user.id).single(),
    client
      .from("dashboard_widgets")
      .select("kind,enabled,position")
      .eq("user_id", user.id)
      .order("position"),
  ]);
  if (profile.error || trackers.error || preferences.error || widgets.error)
    throw new Error("Unable to load your dashboard.");
  // Paginate: never silently truncate history at the API’s default row cap.
  const rawLogs = [];
  for (let from = 0; ; from += 1000) {
    const result = await client
      .from("tracker_logs")
      .select(
        "id,tracker_id,tracking_date,value,created_at,details,template_version_id",
      )
      .eq("user_id", user.id)
      .order("id")
      .range(from, from + 999);
    if (result.error) throw new Error("Unable to load activity.");
    rawLogs.push(...result.data);
    if (result.data.length < 1000) break;
  }
  const templateData = await loadTemplateData(
    client,
    user.id,
    rawLogs.flatMap((l) =>
      l.template_version_id ? [l.template_version_id] : [],
    ),
  );
  const versions = new Map(templateData.templateVersions.map((v) => [v.id, v]));
  const logs: ActivityLog[] = rawLogs.map((log) => {
    const parsed = validateDetails(
      versions.get(log.template_version_id ?? "")?.fields ?? [],
      log.details,
    );
    if (!parsed.success) throw new Error("Unable to read recorded details.");
    return { ...log, details: parsed.data as ActivityLog["details"] };
  });
  return {
    ...templateData,
    email: user.email || "",
    timezone: profile.data.timezone,
    today: dateInTimezone(new Date(), profile.data.timezone),
    trackers: trackers.data.map((t) => ({
      ...t,
      created_date: dateInTimezone(
        new Date(t.created_at),
        profile.data.timezone,
      ),
    })) as ActivityTracker[],
    logs,
    preferences: preferencesSchema.parse({
      ...preferences.data,
      show_activity:
        widgets.data?.find((w) => w.kind === "activity")?.enabled ?? true,
      show_summary:
        widgets.data?.find((w) => w.kind === "summary")?.enabled ?? true,
      show_recent:
        widgets.data?.find((w) => w.kind === "recent")?.enabled ?? true,
      widget_order: ["summary", "activity", "recent"].sort(
        (a, b) =>
          (widgets.data?.find((w) => w.kind === a)?.position ?? 0) -
          (widgets.data?.find((w) => w.kind === b)?.position ?? 0),
      ),
    }),
  };
}
