import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { z } from "zod";
import {
  validateDetails,
  fieldsSchema,
} from "@/features/activity-templates/validation";
import { trackerSchema, logSchema } from "./validation";
import {
  dateInTimezone,
  isScheduled,
  type Tracker,
} from "@/features/tracker-engine/engine";
export type TrackerContext = {
  client: SupabaseClient<Database>;
  user: Pick<User, "id">;
};
export interface MutationResult {
  error?: string;
  success?: boolean;
  logId?: string;
  trackerId?: string;
  fieldErrors?: Record<string, string>;
}
export async function saveTrackerWithContext(
  context: TrackerContext,
  input: unknown,
  id?: string,
): Promise<MutationResult> {
  const parsed = trackerSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (id && !z.uuid().safeParse(id).success)
    return { error: "Invalid tracker." };
  const { client, user } = context;
  const result = id
    ? await client
        .from("trackers")
        .update(parsed.data)
        .eq("id", id)
        .eq("user_id", user.id)
        .select("id")
        .single()
    : await client
        .from("trackers")
        .insert({ ...parsed.data, user_id: user.id })
        .select("id")
        .single();
  if (result.error)
    return { error: "Could not save tracker. Please try again." };
  return { success: true, trackerId: result.data.id };
}
export async function recordLogWithContext(
  context: TrackerContext,
  input: unknown,
): Promise<MutationResult> {
  const parsed = logSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { client, user } = context;
  const [profile, tracker] = await Promise.all([
    client.from("profiles").select("timezone").eq("id", user.id).single(),
    client
      .from("trackers")
      .select("*")
      .eq("id", parsed.data.tracker_id)
      .eq("user_id", user.id)
      .is("archived_at", null)
      .single(),
  ]);
  if (profile.error || tracker.error) return { error: "Tracker unavailable." };
  const today = dateInTimezone(new Date(), profile.data.timezone);
  if (
    parsed.data.date > today ||
    parsed.data.date <
      dateInTimezone(new Date(tracker.data.created_at), profile.data.timezone)
  )
    return { error: "Choose a date within this tracker’s history." };
  if (!isScheduled(tracker.data as Tracker, parsed.data.date))
    return { error: "This tracker is not scheduled on that day." };
  let versionId: string | null = null;
  let fields: ReturnType<typeof fieldsSchema.parse> = [];
  if (tracker.data.activity_template_id) {
    const template = await client
      .from("activity_templates")
      .select("current_version_id")
      .eq("id", tracker.data.activity_template_id)
      .eq("user_id", user.id)
      .single();
    if (template.error || !template.data.current_version_id)
      return { error: "Template unavailable." };
    versionId = template.data.current_version_id;
    const version = await client
      .from("activity_template_versions")
      .select("fields")
      .eq("id", versionId)
      .eq("user_id", user.id)
      .single();
    if (version.error) return { error: "Template unavailable." };
    fields = fieldsSchema.parse(version.data.fields);
  }
  if (
    parsed.data.details &&
    Object.keys(parsed.data.details).length > 0 &&
    parsed.data.template_version_id !== versionId
  )
    return {
      error: "Template changed. Review its current fields before saving.",
    };
  const details = validateDetails(fields, parsed.data.details ?? {});
  if (!details.success) return detailsError(details.error);
  const { error, data } = await client.rpc("record_log_with_details", {
    p_tracker: parsed.data.tracker_id,
    p_date: parsed.data.date,
    p_value: parsed.data.value,
    p_id: parsed.data.request_id,
    p_details: details.data,
    p_template_version:
      parsed.data.details && Object.keys(parsed.data.details).length > 0
        ? (versionId ?? undefined)
        : undefined,
  });
  if (error)
    return {
      error:
        error.message ===
        "Template changed. Review its current fields before saving."
          ? error.message
          : "Could not save check-in. Please try again.",
    };
  return { success: true, logId: data };
}
function detailsError(error: z.ZodError): MutationResult {
  return {
    error: "Check the activity details.",
    fieldErrors: Object.fromEntries(
      error.issues.map((issue) => [
        String(issue.path[0] ?? "details"),
        issue.message,
      ]),
    ),
  };
}
