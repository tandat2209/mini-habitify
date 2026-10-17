import "server-only";
import { requireSession } from "@/lib/auth/session";
import { dateInTimezone } from "@/features/tracker-engine/engine";
import type {
  ActivityLog,
  TemplateVersion,
} from "@/features/activity-templates/types";
import {
  fieldsSchema,
  validateDetails,
} from "@/features/activity-templates/validation";
import {
  preferencesSchema,
  trackerSchema,
} from "@/features/trackers/validation";
import type { Database } from "@/lib/database.types";
import { reviewWindow, summarizeTracker } from "./review";

const reviewPreferences = preferencesSchema.pick({
  theme: true,
  primary_color: true,
  layout: true,
  presentation: true,
});

export async function loadReview(requestedWeek?: string) {
  const { client, user } = await requireSession();
  const [profile, preferences] = await Promise.all([
    client.from("profiles").select("timezone").eq("id", user.id).single(),
    client
      .from("user_preferences")
      .select("theme,primary_color,layout,presentation")
      .eq("user_id", user.id)
      .single(),
  ]);
  if (profile.error || preferences.error)
    throw new Error("Unable to load your review.");
  const timezone = profile.data.timezone;
  const today = dateInTimezone(new Date(), timezone);
  const window = reviewWindow(requestedWeek, today);
  const rawTrackers: Database["public"]["Tables"]["trackers"]["Row"][] = [];
  const rawLogs: Pick<
    Database["public"]["Tables"]["tracker_logs"]["Row"],
    | "id"
    | "tracker_id"
    | "tracking_date"
    | "value"
    | "created_at"
    | "details"
    | "template_version_id"
  >[] = [];
  await Promise.all([
    (async () => {
      for (let from = 0; ; from += 1000) {
        const result = await client
          .from("trackers")
          .select("*")
          .eq("user_id", user.id)
          .order("id")
          .range(from, from + 999);
        if (result.error) throw new Error("Unable to load review trackers.");
        rawTrackers.push(...result.data);
        if (result.data.length < 1000) break;
      }
    })(),
    (async () => {
      for (let from = 0; ; from += 1000) {
        const result = await client
          .from("tracker_logs")
          .select(
            "id,tracker_id,tracking_date,value,created_at,details,template_version_id",
          )
          .eq("user_id", user.id)
          .gte("tracking_date", window.queryFrom)
          .lte("tracking_date", window.cutoff)
          .order("id")
          .range(from, from + 999);
        if (result.error) throw new Error("Unable to load review entries.");
        rawLogs.push(...result.data);
        if (result.data.length < 1000) break;
      }
    })(),
  ]);
  const selectedLogs = rawLogs.filter(
    (log) => log.tracking_date >= window.start,
  );
  const versionIds = [
    ...new Set(
      selectedLogs.flatMap((log) =>
        log.template_version_id ? [log.template_version_id] : [],
      ),
    ),
  ];
  const versions: TemplateVersion[] = [];
  for (let offset = 0; offset < versionIds.length; offset += 100) {
    const result = await client
      .from("activity_template_versions")
      .select("id,template_id,version,fields")
      .eq("user_id", user.id)
      .in("id", versionIds.slice(offset, offset + 100));
    if (result.error) throw new Error("Unable to load recorded details.");
    versions.push(
      ...result.data.map((version) => ({
        ...version,
        fields: fieldsSchema.parse(version.fields),
      })),
    );
  }
  const versionMap = new Map(versions.map((version) => [version.id, version]));
  const entries: ActivityLog[] = selectedLogs.map((log) => {
    const version = versionMap.get(log.template_version_id ?? "");
    if (log.template_version_id && !version)
      throw new Error("Unable to load recorded details.");
    const parsed = validateDetails(version?.fields ?? [], log.details);
    if (!parsed.success) throw new Error("Unable to read recorded details.");
    return { ...log, details: parsed.data as ActivityLog["details"] };
  });
  const rows = rawTrackers
    .map((tracker) => {
      const normalized = {
        ...tracker,
        type: trackerSchema.shape.type.parse(tracker.type),
        goal_period: trackerSchema.shape.goal_period.parse(tracker.goal_period),
        created_date: dateInTimezone(new Date(tracker.created_at), timezone),
      };
      const summary = summarizeTracker(normalized, rawLogs, window);
      if (!summary) return null;
      return {
        tracker: normalized,
        summary,
        entries: entries
          .filter((log) => log.tracker_id === tracker.id)
          .sort(
            (a, b) =>
              b.tracking_date.localeCompare(a.tracking_date) ||
              b.created_at.localeCompare(a.created_at) ||
              b.id.localeCompare(a.id),
          ),
      };
    })
    .filter((row) => row !== null)
    .sort((a, b) => a.tracker.name.localeCompare(b.tracker.name));
  return {
    window,
    timezone,
    preferences: reviewPreferences.parse(preferences.data),
    rows,
    versions,
  };
}
export type ReviewData = Awaited<ReturnType<typeof loadReview>>;
