import { beforeAll, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
process.loadEnvFile(".env.local");
let a: SupabaseClient, b: SupabaseClient, anon: SupabaseClient, aid: string;
const widgets = [
  { kind: "summary", enabled: true },
  { kind: "activity", enabled: true },
  { kind: "recent", enabled: true },
];
beforeAll(async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  a = createClient(url, key, { auth: { persistSession: false } });
  b = createClient(url, key, { auth: { persistSession: false } });
  anon = createClient(url, key, { auth: { persistSession: false } });
  for (const client of [a, b]) {
    const result = await client.auth.signUp({
      email: `accent-${crypto.randomUUID()}@example.com`,
      password: "secure-test-password",
    });
    expect(result.error).toBeNull();
    if (client === a) aid = result.data.user!.id;
  }
});
it("defaults to the theme palette and saves/resets custom colors atomically", async () => {
  expect(
    (await a.from("user_preferences").select().eq("user_id", aid).single()).data
      .primary_color,
  ).toBeNull();
  const args = {
    p_theme: "neumorphism",
    p_layout: "standard",
    p_presentation: "calm",
    p_widgets: widgets,
  };
  expect(
    (
      await a.rpc("save_dashboard_appearance_with_color", {
        ...args,
        p_primary_color: "#4f8ec9",
      })
    ).error,
  ).toBeNull();
  expect(
    (await a.from("user_preferences").select().eq("user_id", aid).single())
      .data,
  ).toMatchObject({ theme: "neumorphism", primary_color: "#4f8ec9" });
  expect(
    (await a.rpc("save_dashboard_appearance", { ...args, p_theme: "terminal" }))
      .error,
  ).toBeNull();
  expect(
    (await a.from("user_preferences").select().eq("user_id", aid).single()).data
      .primary_color,
  ).toBe("#4f8ec9");
  expect(
    (await a.rpc("save_dashboard_appearance_with_color", args)).error,
  ).toBeNull();
  expect(
    (await a.from("user_preferences").select().eq("user_id", aid).single()).data
      .primary_color,
  ).toBeNull();
});
it("rejects invalid colors through both RPC and direct writes without partial changes", async () => {
  const before = (
    await a.from("user_preferences").select().eq("user_id", aid).single()
  ).data;
  for (const color of ["red", "#fff", "#zzzzzz", "red;display:none"]) {
    expect(
      (
        await a.rpc("save_dashboard_appearance_with_color", {
          p_theme: "terminal",
          p_layout: "compact",
          p_presentation: "developer",
          p_widgets: [...widgets].reverse(),
          p_primary_color: color,
        })
      ).error,
    ).not.toBeNull();
    expect(
      (
        await a
          .from("user_preferences")
          .update({ primary_color: color })
          .eq("user_id", aid)
      ).error,
    ).not.toBeNull();
  }
  expect(
    (await a.from("user_preferences").select().eq("user_id", aid).single())
      .data,
  ).toEqual(before);
  expect(
    (
      await a
        .from("dashboard_widgets")
        .select("kind")
        .eq("user_id", aid)
        .order("position")
    ).data,
  ).toEqual(widgets.map(({ kind }) => ({ kind })));
});
it("keeps color preferences private and rejects anonymous changes", async () => {
  expect(
    (await b.from("user_preferences").select().eq("user_id", aid)).data,
  ).toEqual([]);
  expect(
    (
      await b
        .from("user_preferences")
        .update({ primary_color: "#123456" })
        .eq("user_id", aid)
        .select()
    ).data,
  ).toEqual([]);
  expect(
    (
      await anon.rpc("save_dashboard_appearance_with_color", {
        p_theme: "paper",
        p_layout: "standard",
        p_presentation: "calm",
        p_widgets: widgets,
        p_primary_color: "#123456",
      })
    ).error,
  ).not.toBeNull();
});
