import "server-only";
import { requireSession } from "@/lib/auth/session";
import {
  dateInTimezone,
  type Tracker,
  type Log,
} from "@/features/tracker-engine/engine";
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
      .select("kind,enabled")
      .eq("user_id", user.id),
  ]);
  if (profile.error || trackers.error || preferences.error || widgets.error)
    throw new Error("Unable to load your dashboard.");
  // Paginate: never silently truncate history at the API’s default row cap.
  const logs: Log[] = [];
  for (let from = 0; ; from += 1000) {
    const result = await client
      .from("tracker_logs")
      .select("id,tracker_id,tracking_date,value,created_at")
      .eq("user_id", user.id)
      .order("id")
      .range(from, from + 999);
    if (result.error) throw new Error("Unable to load activity.");
    logs.push(...result.data);
    if (result.data.length < 1000) break;
  }
  return {
    email: user.email || "",
    timezone: profile.data.timezone,
    today: dateInTimezone(new Date(), profile.data.timezone),
    trackers: trackers.data.map((t) => ({
      ...t,
      created_date: dateInTimezone(
        new Date(t.created_at),
        profile.data.timezone,
      ),
    })) as Tracker[],
    logs,
    preferences: preferencesSchema.parse({
      ...preferences.data,
      show_activity:
        widgets.data?.find((w) => w.kind === "activity")?.enabled ?? true,
    }),
  };
}
