"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  validateDetails,
  fieldsSchema,
} from "@/features/activity-templates/validation";
import { requireSession } from "@/lib/auth/session";
import { logSchema, preferencesSchema } from "./validation";
export type { MutationResult } from "./service";
import {
  saveTrackerWithContext,
  recordLogWithContext,
  type MutationResult,
} from "./service";
export async function saveTracker(
  input: unknown,
  id?: string,
): Promise<MutationResult> {
  const result = await saveTrackerWithContext(
    await requireSession(),
    input,
    id,
  );
  if (result.success) revalidatePath("/today", "layout");
  return result;
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
  const result = await recordLogWithContext(await requireSession(), input);
  if (result.success) revalidatePath("/today", "layout");
  return result;
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
