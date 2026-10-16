"use server";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/session";
import { publishTemplateWithContext } from "./service";
import type { MutationResult } from "../trackers/actions";
export async function publishTemplate(
  input: unknown,
  id?: string,
): Promise<MutationResult> {
  const result = await publishTemplateWithContext(
    await requireSession(),
    input,
    id,
  );
  if (!result.success) return result;
  revalidatePath("/today", "layout");
  return result;
}
