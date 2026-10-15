import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { dateInTimezone } from "../../src/features/tracker-engine/engine";
process.loadEnvFile(".env.local");
let a: SupabaseClient, b: SupabaseClient, aid: string, bid: string;
const today = dateInTimezone(new Date(), "Asia/Ho_Chi_Minh");
const fields = [
  { key: "summary", label: "Summary", type: "text", required: true },
  { key: "rating", label: "Rating", type: "number", required: false },
  { key: "date", label: "Date", type: "date", required: false },
  { key: "mode", label: "Mode", type: "select", options: ["Solo", "Together"] },
  {
    key: "tags",
    label: "Tags",
    type: "multi_select",
    options: ["New", "Review"],
  },
  { key: "items", label: "Items", type: "list" },
];
async function publish(template: string | null, definition = fields) {
  return a.rpc("publish_activity_template", {
    p_template: template,
    p_name: "Session",
    p_description: "",
    p_fields: definition,
  });
}
async function tracker(template: string | null = null, type = "counter") {
  const result = await a
    .from("trackers")
    .insert({
      user_id: aid,
      name: "Activity",
      type,
      target: 1,
      activity_template_id: template,
    })
    .select()
    .single();
  expect(result.error).toBeNull();
  return result.data.id as string;
}
async function record(
  id: string,
  details = {},
  version: string | null = null,
  request = crypto.randomUUID(),
) {
  return a.rpc("record_log_with_details", {
    p_tracker: id,
    p_date: today,
    p_value: 1,
    p_id: request,
    p_details: details,
    p_template_version: version,
  });
}
beforeAll(async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  a = createClient(url, key, { auth: { persistSession: false } });
  b = createClient(url, key, { auth: { persistSession: false } });
  for (const c of [a, b]) {
    const result = await c.auth.signUp({
      email: `templates-${crypto.randomUUID()}@example.com`,
      password: "secure-test-password",
      options: { data: { timezone: "Asia/Ho_Chi_Minh" } },
    });
    expect(result.error).toBeNull();
    if (c === a) aid = result.data.user!.id;
    else bid = result.data.user!.id;
  }
});
describe("template persistence and compatibility", () => {
  it("keeps the existing RPC and legacy update path compatible", async () => {
    const id = await tracker();
    const request = crypto.randomUUID();
    expect(
      (
        await a.rpc("record_log", {
          p_tracker: id,
          p_date: today,
          p_value: 2,
          p_id: request,
        })
      ).error,
    ).toBeNull();
    const row = await a
      .from("tracker_logs")
      .select()
      .eq("id", request)
      .single();
    expect(row.data).toMatchObject({
      details: {},
      template_version_id: null,
      value: 2,
    });
    expect(
      (await a.from("tracker_logs").update({ value: 3 }).eq("id", request))
        .error,
    ).toBeNull();
  });
  it("persists all generic values, allows skipping details, and reuses a template", async () => {
    const created = await publish(null);
    expect(created.error).toBeNull();
    const template = created.data as string;
    const version = (
      await a.from("activity_templates").select().eq("id", template).single()
    ).data.current_version_id;
    for (const id of [await tracker(template), await tracker(template)]) {
      expect((await record(id)).error).toBeNull();
      const saved = await record(
        id,
        {
          summary: "Done",
          rating: 0,
          date: today,
          mode: "Solo",
          tags: ["New"],
          items: ["One"],
        },
        version,
      );
      expect(saved.error).toBeNull();
      expect(
        (await a.from("tracker_logs").select().eq("id", saved.data).single())
          .data,
      ).toMatchObject({
        details: { summary: "Done", rating: 0 },
        template_version_id: version,
      });
    }
  });
  it("rejects invalid definitions and details through direct database writes", async () => {
    for (const invalid of [
      [],
      [{ key: "constructor", label: "Bad", type: "text" }],
      [{ key: "x", label: "X", type: "select" }],
      [fields[0], fields[0]],
    ])
      expect((await publish(null, invalid)).error).not.toBeNull();
    const template = (await publish(null)).data;
    const id = await tracker(template);
    for (const details of [
      { rating: 2 },
      { summary: " " },
      { summary: "\t\n" },
      { summary: "\u00a0" },
      { summary: "Done", unknown: true },
      { summary: "Done", rating: "2" },
      { summary: "Done", date: "2026-02-30" },
      { summary: "Done", mode: "Other" },
      { summary: "Done", tags: ["New", "New"] },
      { summary: "Done", items: [2] },
    ]) {
      expect(
        (
          await a.from("tracker_logs").insert({
            user_id: aid,
            tracker_id: id,
            tracker_type: "counter",
            tracking_date: today,
            value: 1,
            details,
          })
        ).error,
      ).not.toBeNull();
    }
  });
  it("preserves immutable versions and historical edits across template changes", async () => {
    const template = (await publish(null)).data;
    const v1 = (
      await a.from("activity_templates").select().eq("id", template).single()
    ).data.current_version_id;
    const id = await tracker(template);
    const log = await record(id, { summary: "Original" }, v1);
    expect(log.error).toBeNull();
    expect(
      (
        await publish(template, [
          { key: "new", label: "New field", type: "number" },
        ])
      ).error,
    ).toBeNull();
    const v2 = (
      await a.from("activity_templates").select().eq("id", template).single()
    ).data.current_version_id;
    expect(v2).not.toBe(v1);
    expect((await record(id, { summary: "Stale" }, v1)).error).not.toBeNull();
    const next = await record(id, { new: 4 }, v2);
    expect(next.error).toBeNull();
    expect(
      (
        await a
          .from("tracker_logs")
          .update({ details: { summary: "Edited" }, value: 2 })
          .eq("id", log.data)
      ).error,
    ).toBeNull();
    expect(
      (
        await a
          .from("tracker_logs")
          .update({ template_version_id: v2 })
          .eq("id", log.data)
      ).error,
    ).not.toBeNull();
    expect(
      (
        await a
          .from("activity_template_versions")
          .update({ fields: [] })
          .eq("id", v1)
          .select()
      ).data ?? [],
    ).toEqual([]);
    expect(
      (
        await a
          .from("activity_template_versions")
          .delete()
          .eq("id", v1)
          .select()
      ).data ?? [],
    ).toEqual([]);
    expect(
      (
        await a
          .from("activity_template_versions")
          .select()
          .eq("id", v1)
          .single()
      ).data.fields,
    ).toEqual(fields);
    const other = (await publish(null)).data;
    expect(
      (
        await a
          .from("trackers")
          .update({ activity_template_id: other })
          .eq("id", id)
      ).error,
    ).toBeNull();
    expect(
      (
        await a
          .from("tracker_logs")
          .update({ details: { summary: "Still original schema" } })
          .eq("id", log.data)
      ).error,
    ).toBeNull();
    expect(
      (
        await a
          .from("trackers")
          .update({ activity_template_id: null })
          .eq("id", id)
      ).error,
    ).toBeNull();
    expect((await record(id)).error).toBeNull();
    expect(
      (await a.from("tracker_logs").select().eq("id", log.data).single()).data
        .template_version_id,
    ).toBe(v1);
  });
  it("keeps legacy entries template-free after association and preserves retry content", async () => {
    const id = await tracker(null, "habit");
    const request = crypto.randomUUID();
    const first = await record(id, {}, null, request);
    expect(first.error).toBeNull();
    const template = (await publish(null)).data;
    await a
      .from("trackers")
      .update({ activity_template_id: template })
      .eq("id", id);
    const retried = await record(id, { summary: "Do not overwrite" });
    expect(retried.data).toBe(first.data);
    expect(
      (await a.from("tracker_logs").update({ value: 1 }).eq("id", request))
        .error,
    ).toBeNull();
    expect(
      (await a.from("tracker_logs").select().eq("id", request).single()).data,
    ).toMatchObject({ details: {}, template_version_id: null });
  });
  it("isolates templates, versions, associations, publication and check-in content", async () => {
    const template = (await publish(null)).data;
    const v1 = (
      await a.from("activity_templates").select().eq("id", template).single()
    ).data.current_version_id;
    expect(
      (await b.from("activity_templates").select().eq("id", template)).data,
    ).toEqual([]);
    expect(
      (await b.from("activity_template_versions").select().eq("id", v1)).data,
    ).toEqual([]);
    expect(
      (
        await b.rpc("publish_activity_template", {
          p_template: template,
          p_name: "Spoof",
          p_description: "",
          p_fields: fields,
        })
      ).error,
    ).not.toBeNull();
    expect(
      (
        await b.from("trackers").insert({
          user_id: bid,
          name: "Spoof",
          activity_template_id: template,
        })
      ).error,
    ).not.toBeNull();
    expect(
      (
        await a
          .from("activity_templates")
          .update({ user_id: bid })
          .eq("id", template)
      ).error,
    ).not.toBeNull();
    const other = await b.rpc("publish_activity_template", {
      p_template: null,
      p_name: "Other",
      p_description: "",
      p_fields: fields,
    });
    const otherVersion = (
      await b.from("activity_templates").select().eq("id", other.data).single()
    ).data.current_version_id;
    expect(
      (
        await record(
          await tracker(template),
          { summary: "Spoof" },
          otherVersion,
        )
      ).error,
    ).not.toBeNull();
  });
});
