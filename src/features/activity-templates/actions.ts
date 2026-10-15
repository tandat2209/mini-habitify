"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { templateSchema } from "./validation";
import type { MutationResult } from "../trackers/actions";
export async function publishTemplate(
  input: unknown,
  id?: string,
): Promise<MutationResult> {
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (id && !z.uuid().safeParse(id).success)
    return { error: "Invalid template." };
  const { client } = await requireSession();
  const result = await client.rpc("publish_activity_template", {
    p_template: id,
    p_name: parsed.data.name,
    p_description: parsed.data.description,
    p_fields: parsed.data.fields,
  });
  if (result.error)
    return { error: "Could not publish template. Please try again." };
  revalidatePath("/today", "layout");
  return { success: true };
}
