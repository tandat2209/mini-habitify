import "server-only";
import { z } from "zod";
import type { TrackerContext, MutationResult } from "../trackers/service";
import {
  fieldsSchema,
  mergeTemplateFields,
  templatePatchSchema,
  templateSchema,
} from "./validation";

export async function publishTemplateWithContext(
  context: TrackerContext,
  input: unknown,
  id?: string,
): Promise<MutationResult> {
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (id && !z.uuid().safeParse(id).success)
    return { error: "Invalid template." };
  const { data, error } = await context.client.rpc(
    "publish_activity_template",
    {
      p_template: id,
      p_name: parsed.data.name,
      p_description: parsed.data.description,
      p_fields: parsed.data.fields,
    },
  );
  return error
    ? {
        error:
          "Could not publish template. Check that it is active. For older assistant connections, reconnect and allow template management.",
      }
    : { success: true, templateId: data };
}

export async function updateTemplateWithContext(
  context: TrackerContext,
  id: string,
  expectedVersion: string,
  input: unknown,
): Promise<MutationResult> {
  const parsed = templatePatchSchema.safeParse(input);
  if (
    !z.uuid().safeParse(id).success ||
    !z.uuid().safeParse(expectedVersion).success
  )
    return { error: "Invalid template or version." };
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const version = await context.client
    .from("activity_template_versions")
    .select("fields")
    .eq("id", expectedVersion)
    .eq("template_id", id)
    .eq("user_id", context.user.id)
    .single();
  if (version.error) return { error: "Template version unavailable." };
  const current = fieldsSchema.safeParse(version.data.fields);
  if (!current.success) return { error: "Template definition unavailable." };
  let fields;
  try {
    fields = mergeTemplateFields(
      current.data,
      parsed.data.upsert_fields ?? [],
      parsed.data.remove_field_keys ?? [],
    );
  } catch {
    return { error: "Use 1 to 30 valid fields with unique keys." };
  }
  const { error, data } = await context.client.rpc("update_activity_template", {
    p_template: id,
    p_expected_version: expectedVersion,
    p_name: parsed.data.name,
    p_description: parsed.data.description,
    p_fields: fields,
  });
  return error
    ? {
        error:
          error.code === "PT409"
            ? "Template changed. Read it again before updating."
            : "Could not update template. Check that it is active. For older assistant connections, reconnect and allow template management.",
      }
    : { success: true, templateId: data };
}

export async function archiveTemplateWithContext(
  context: TrackerContext,
  id: string,
): Promise<MutationResult> {
  if (!z.uuid().safeParse(id).success) return { error: "Invalid template." };
  const { error } = await context.client
    .from("activity_templates")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", context.user.id)
    .select("id")
    .single();
  return error
    ? { error: "Could not archive template." }
    : { success: true, templateId: id };
}
