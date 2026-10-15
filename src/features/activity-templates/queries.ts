import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { fieldsSchema } from "./validation";
import type { ActivityTemplate, TemplateData, TemplateVersion } from "./types";
export async function loadTemplateData(
  client: SupabaseClient<Database>,
  userId: string,
  historicalVersionIds: string[],
): Promise<TemplateData> {
  const templates: ActivityTemplate[] = [];
  for (let from = 0; ; from += 1000) {
    const result = await client
      .from("activity_templates")
      .select("id,name,description,current_version_id")
      .eq("user_id", userId)
      .order("id")
      .range(from, from + 999);
    if (result.error) throw new Error("Unable to load templates.");
    templates.push(...result.data);
    if (result.data.length < 1000) break;
  }
  const ids = [
    ...new Set([
      ...historicalVersionIds,
      ...templates.flatMap((t) =>
        t.current_version_id ? [t.current_version_id] : [],
      ),
    ]),
  ];
  const batches = await Promise.all(
    Array.from({ length: Math.ceil(ids.length / 100) }, async (_, index) => {
      const result = await client
        .from("activity_template_versions")
        .select("id,template_id,version,fields")
        .eq("user_id", userId)
        .in("id", ids.slice(index * 100, (index + 1) * 100));
      if (result.error)
        throw new Error("Unable to load recorded template versions.");
      return result.data.map((v): TemplateVersion => ({
        ...v,
        fields: fieldsSchema.parse(v.fields),
      }));
    }),
  );
  return { templates, templateVersions: batches.flat() };
}
