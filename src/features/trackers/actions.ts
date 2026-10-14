"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
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
  revalidatePath("/today");
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
  revalidatePath("/today");
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
  const { error } = await client.rpc("record_log", {
    p_tracker: parsed.data.tracker_id,
    p_date: parsed.data.date,
    p_value: parsed.data.value,
    p_id: parsed.data.request_id,
  });
  if (error) return { error: "Could not save check-in. Please try again." };
  revalidatePath("/today");
  return { success: true };
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
  revalidatePath("/today");
  return { success: true };
}
export async function savePreferences(input: unknown): Promise<MutationResult> {
  const parsed = preferencesSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid appearance preferences." };
  const { client } = await requireSession();
  const { error } = await client.rpc("save_appearance", {
    p_theme: parsed.data.theme,
    p_layout: parsed.data.layout,
    p_presentation: parsed.data.presentation,
    p_show_activity: parsed.data.show_activity,
  });
  if (error) return { error: "Could not save appearance." };
  revalidatePath("/today");
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
  const { error } = await client
    .from("tracker_logs")
    .update({
      tracking_date: parsed.data.date,
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
  revalidatePath("/today");
  return { success: true };
}
