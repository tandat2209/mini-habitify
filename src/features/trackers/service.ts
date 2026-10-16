import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { z } from "zod";
import {
  validateDetails,
  fieldsSchema,
} from "@/features/activity-templates/validation";
import {
  trackerSchema,
  trackerPatchSchema,
  checkinPatchSchema,
  logSchema,
} from "./validation";
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
  templateId?: string;
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

export async function updateTrackerWithContext(
  context: TrackerContext,
  id: string,
  input: unknown,
): Promise<MutationResult> {
  const patch = trackerPatchSchema.safeParse(input);
  if (!z.uuid().safeParse(id).success) return { error: "Invalid tracker." };
  if (!patch.success) return { error: patch.error.issues[0].message };
  const current = await context.client
    .from("trackers")
    .select("*")
    .eq("id", id)
    .eq("user_id", context.user.id)
    .single();
  if (current.error) return { error: "Tracker unavailable." };
  const complete = trackerSchema.safeParse({ ...current.data, ...patch.data });
  if (!complete.success) return { error: complete.error.issues[0].message };
  const { error } = await context.client
    .from("trackers")
    .update(patch.data)
    .eq("id", id)
    .eq("user_id", context.user.id)
    .select("id")
    .single();
  return error
    ? {
        error:
          "Could not update tracker. Check the goal, schedule and active template.",
      }
    : { success: true, trackerId: id };
}

export async function updateCheckinWithContext(
  context: TrackerContext,
  id: string,
  input: unknown,
): Promise<MutationResult> {
  const parsed = checkinPatchSchema.safeParse(input);
  if (!z.uuid().safeParse(id).success) return { error: "Invalid entry." };
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { client, user } = context;
  const log = await client
    .from("tracker_logs")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (log.error) return { error: "Entry unavailable." };
  const tracker = await client
    .from("trackers")
    .select("type")
    .eq("id", log.data.tracker_id)
    .eq("user_id", user.id)
    .is("archived_at", null)
    .single();
  if (tracker.error) return { error: "Tracker unavailable." };
  let fields: ReturnType<typeof fieldsSchema.parse> = [];
  if (log.data.template_version_id) {
    const version = await client
      .from("activity_template_versions")
      .select("fields")
      .eq("id", log.data.template_version_id)
      .eq("user_id", user.id)
      .single();
    if (version.error) return { error: "Recorded template unavailable." };
    fields = fieldsSchema.parse(version.data.fields);
  }
  const { details, remove_detail_keys, ...patch } = parsed.data;
  let content;
  if (details !== undefined || remove_detail_keys !== undefined) {
    const saved = z
      .record(
        z.string(),
        z.union([z.string(), z.number(), z.array(z.string())]),
      )
      .parse(log.data.details);
    const merged = { ...saved, ...details };
    for (const key of remove_detail_keys ?? []) delete merged[key];
    const validated = validateDetails(fields, merged);
    if (!validated.success) return detailsError(validated.error);
    content = validated.data;
  }
  const { error } = await client
    .from("tracker_logs")
    .update({
      ...(patch.date !== undefined ? { tracking_date: patch.date } : {}),
      ...(patch.value !== undefined
        ? { value: tracker.data.type === "habit" ? 1 : patch.value }
        : {}),
      ...(content !== undefined ? { details: content } : {}),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("tracker_id", log.data.tracker_id)
    .select("id")
    .single();
  return error
    ? { error: "Could not edit entry. Check the date and tracker schedule." }
    : { success: true, logId: id };
}
