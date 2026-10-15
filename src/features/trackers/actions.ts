"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  validateDetails,
  fieldsSchema,
} from "@/features/activity-templates/validation";
import { requireSession } from "@/lib/auth/session";
import { trackerSchema, logSchema, preferencesSchema } from "./validation";
import {
  dateInTimezone,
  isScheduled,
  type Tracker,
} from "@/features/tracker-engine/engine";
export interface MutationResult {
  error?: string;
  success?: boolean;
  logId?: string;
  fieldErrors?: Record<string, string>;
}
export async function saveTracker(
  input: unknown,
  id?: string,
): Promise<MutationResult> {
  const parsed = trackerSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (id && !z.uuid().safeParse(id).success)
    return { error: "Invalid tracker." };
  const { client, user } = await requireSession();
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
  revalidatePath("/today", "layout");
  return { success: true };
}
export async function archiveTracker(id: string): Promise<MutationResult> {
  if (!z.uuid().safeParse(id).success) return { error: "Invalid tracker." };
  const { client, user } = await requireSession();
  const { error } = await client
    .from("trackers")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .single();
  if (error) return { error: "Could not archive tracker." };
  revalidatePath("/today", "layout");
  return { success: true };
}
export async function recordLog(input: unknown): Promise<MutationResult> {
  const parsed = logSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { client, user } = await requireSession();
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
  revalidatePath("/today", "layout");
  return { success: true, logId: data };
}
export async function deleteLog(id: string): Promise<MutationResult> {
  if (!z.uuid().safeParse(id).success) return { error: "Invalid entry." };
  const { client, user } = await requireSession();
  const { error } = await client
    .from("tracker_logs")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .single();
  if (error) return { error: "Could not remove entry." };
  revalidatePath("/today", "layout");
  return { success: true };
}
export async function savePreferences(input: unknown): Promise<MutationResult> {
  const parsed = preferencesSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid appearance preferences." };
  const { client } = await requireSession();
  const { error } = await client.rpc("save_dashboard_appearance_with_color", {
    p_theme: parsed.data.theme,
    p_primary_color: parsed.data.primary_color ?? undefined,
    p_layout: parsed.data.layout,
    p_presentation: parsed.data.presentation,
    p_widgets: parsed.data.widget_order.map((kind) => ({
      kind,
      enabled:
        kind === "summary"
          ? parsed.data.show_summary
          : kind === "activity"
            ? parsed.data.show_activity
            : parsed.data.show_recent,
    })),
  });
  if (error) return { error: "Could not save appearance." };
  revalidatePath("/today", "layout");
  return { success: true };
}

export async function updateLog(
  id: string,
  input: unknown,
): Promise<MutationResult> {
  const parsed = logSchema.safeParse(input);
  if (!z.uuid().safeParse(id).success || !parsed.success)
    return { error: "Invalid entry." };
  const { client, user } = await requireSession();
  const { data: tracker, error: trackerError } = await client
    .from("trackers")
    .select("type")
    .eq("id", parsed.data.tracker_id)
    .eq("user_id", user.id)
    .is("archived_at", null)
    .single();
  if (trackerError) return { error: "Tracker unavailable." };
  const log = await client
    .from("tracker_logs")
    .select("template_version_id")
    .eq("id", id)
    .eq("tracker_id", parsed.data.tracker_id)
    .eq("user_id", user.id)
    .single();
  if (log.error) return { error: "Entry unavailable." };
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
  if (parsed.data.details !== undefined) {
    const details = validateDetails(fields, parsed.data.details);
    if (!details.success) return detailsError(details.error);
  }
  const { error } = await client
    .from("tracker_logs")
    .update({
      tracking_date: parsed.data.date,
      ...(parsed.data.details !== undefined
        ? { details: parsed.data.details }
        : {}),
      value: tracker.type === "habit" ? 1 : parsed.data.value,
    })
    .eq("id", id)
    .eq("tracker_id", parsed.data.tracker_id)
    .eq("user_id", user.id)
    .select("id")
    .single();
  if (error)
    return {
      error: "Could not edit entry. Check the date and tracker schedule.",
    };
  revalidatePath("/today", "layout");
  return { success: true };
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
