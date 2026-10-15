import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { dateInTimezone } from "../../src/features/tracker-engine/engine";
process.loadEnvFile(".env.local");
const today = dateInTimezone(new Date(), "Asia/Ho_Chi_Minh");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
let a: SupabaseClient,
  b: SupabaseClient,
  anon: SupabaseClient,
  aid: string,
  bid: string,
  tracker: string;
beforeAll(async () => {
  a = createClient(url, key, { auth: { persistSession: false } });
  b = createClient(url, key, { auth: { persistSession: false } });
  anon = createClient(url, key, { auth: { persistSession: false } });
  const signup = async (c: SupabaseClient) => {
    const result = await c.auth.signUp({
      email: `security-${crypto.randomUUID()}@example.com`,
      password: "secure-test-password",
      options: { data: { timezone: "Asia/Ho_Chi_Minh" } },
    });
    expect(result.error).toBeNull();
    return result.data.user!.id;
  };
  aid = await signup(a);
  bid = await signup(b);
});
describe("real RLS and persistence", () => {
  it("creates and reads an owned tracker", async () => {
    const result = await a
      .from("trackers")
      .insert({ user_id: aid, name: "Private habit", type: "habit", target: 1 })
      .select()
      .single();
    expect(result.error).toBeNull();
    tracker = result.data.id;
    expect(
      (await a.from("trackers").select().eq("id", tracker)).data,
    ).toHaveLength(1);
  });
  it("hides data from another user and anonymous requests", async () => {
    expect((await b.from("trackers").select().eq("id", tracker)).data).toEqual(
      [],
    );
    expect(
      (await anon.from("trackers").select().eq("id", tracker)).data,
    ).toEqual([]);
  });
  it("rejects spoofed ownership and owner reassignment", async () => {
    expect(
      (await b.from("trackers").insert({ user_id: aid, name: "Spoof" })).error,
    ).not.toBeNull();
    expect(
      (await a.from("trackers").update({ user_id: bid }).eq("id", tracker))
        .error,
    ).not.toBeNull();
  });
  it("rejects logs against another user’s tracker", async () => {
    expect(
      (
        await b.from("tracker_logs").insert({
          user_id: bid,
          tracker_id: tracker,
          tracker_type: "habit",
          tracking_date: today,
          value: 1,
        })
      ).error,
    ).not.toBeNull();
    expect(
      (
        await b.rpc("record_log", {
          p_tracker: tracker,
          p_date: today,
          p_value: 1,
          p_id: crypto.randomUUID(),
        })
      ).error,
    ).not.toBeNull();
  });
  it("makes duplicate habit check-ins idempotent and persists logs", async () => {
    const args = {
      p_tracker: tracker,
      p_date: today,
      p_value: 1,
      p_id: crypto.randomUUID(),
    };
    expect((await a.rpc("record_log", args)).error).toBeNull();
    expect(
      (await a.rpc("record_log", { ...args, p_id: crypto.randomUUID() })).error,
    ).toBeNull();
    expect(
      (await a.from("tracker_logs").select().eq("tracker_id", tracker)).data,
    ).toHaveLength(1);
    expect(
      (await b.from("tracker_logs").select().eq("tracker_id", tracker)).data,
    ).toEqual([]);
  });
  it("isolates preferences and widgets", async () => {
    expect(
      (await b.from("user_preferences").select().eq("user_id", aid)).data,
    ).toEqual([]);
    expect(
      (
        await b
          .from("dashboard_widgets")
          .insert({ user_id: aid, kind: "activity" })
      ).error,
    ).not.toBeNull();
    expect(
      (
        await b
          .from("profiles")
          .update({ timezone: "UTC" })
          .eq("id", aid)
          .select()
      ).data,
    ).toEqual([]);
  });
  it("exposes theme catalog for reading but not writing", async () => {
    expect((await anon.from("themes").select()).data).toHaveLength(5);
    expect(
      (await b.from("themes").insert({ id: "malicious", name: "Malicious" }))
        .error,
    ).not.toBeNull();
  });
  it("persists appearance and widget configuration together", async () => {
    const result = await a.rpc("save_appearance", {
      p_theme: "terminal",
      p_layout: "compact",
      p_presentation: "developer",
      p_show_activity: false,
    });
    expect(result.error).toBeNull();
    expect(
      (
        await a
          .from("user_preferences")
          .select("theme,layout,presentation")
          .eq("user_id", aid)
          .single()
      ).data,
    ).toEqual({
      theme: "terminal",
      layout: "compact",
      presentation: "developer",
    });
    expect(
      (
        await a
          .from("dashboard_widgets")
          .select("enabled")
          .eq("user_id", aid)
          .eq("kind", "activity")
          .single()
      ).data?.enabled,
    ).toBe(false);
    expect(
      (await b.from("dashboard_widgets").select().eq("user_id", aid)).data,
    ).toEqual([]);
  });
  it("saves ordered widget settings atomically and isolates them", async () => {
    const widgets = [
      { kind: "recent", enabled: false },
      { kind: "activity", enabled: true },
      { kind: "summary", enabled: false },
    ];
    expect(
      (
        await a.rpc("save_dashboard_appearance", {
          p_theme: "pastel",
          p_layout: "standard",
          p_presentation: "playful",
          p_widgets: widgets,
        })
      ).error,
    ).toBeNull();
    const saved = await a
      .from("dashboard_widgets")
      .select("kind,enabled,position")
      .eq("user_id", aid)
      .order("position");
    expect(saved.data).toEqual(
      widgets.map((w, position) => ({ ...w, position })),
    );
    expect(
      (await b.from("dashboard_widgets").select().eq("user_id", aid)).data,
    ).toEqual([]);
    expect(
      (
        await a.rpc("save_dashboard_appearance", {
          p_theme: "paper",
          p_layout: "standard",
          p_presentation: "calm",
          p_widgets: [
            { kind: "summary", enabled: true },
            { kind: "summary", enabled: true },
          ],
        })
      ).error,
    ).not.toBeNull();
    expect(
      (
        await a
          .from("user_preferences")
          .select("theme")
          .eq("user_id", aid)
          .single()
      ).data?.theme,
    ).toBe("pastel");
  });
  it("rejects future entries even through direct table writes", async () => {
    expect(
      (
        await a.from("tracker_logs").insert({
          user_id: aid,
          tracker_id: tracker,
          tracker_type: "habit",
          tracking_date: "2099-01-01",
          value: 1,
        })
      ).error,
    ).not.toBeNull();
  });
  it("validates profile timezone changes", async () => {
    expect(
      (
        await a
          .from("profiles")
          .update({ timezone: "Invalid/Zone" })
          .eq("id", aid)
      ).error,
    ).not.toBeNull();
  });
  it("persists Neumorphism without changing tracking data", async () => {
    const before = await a
      .from("tracker_logs")
      .select()
      .eq("user_id", aid)
      .order("id");
    expect(
      (
        await a.rpc("save_dashboard_appearance", {
          p_theme: "neumorphism",
          p_layout: "standard",
          p_presentation: "calm",
          p_widgets: [
            { kind: "summary", enabled: true },
            { kind: "activity", enabled: true },
            { kind: "recent", enabled: true },
          ],
        })
      ).error,
    ).toBeNull();
    expect(
      (
        await a
          .from("user_preferences")
          .select("theme")
          .eq("user_id", aid)
          .single()
      ).data?.theme,
    ).toBe("neumorphism");
    expect(
      (await a.from("tracker_logs").select().eq("user_id", aid).order("id"))
        .data,
    ).toEqual(before.data);
  });
  it("archives without losing history and rejects new logs", async () => {
    expect(
      (
        await a
          .from("trackers")
          .update({ archived_at: new Date().toISOString() })
          .eq("id", tracker)
      ).error,
    ).toBeNull();
    expect(
      (await a.from("tracker_logs").select().eq("tracker_id", tracker)).data,
    ).toHaveLength(1);
    expect(
      (
        await a.rpc("record_log", {
          p_tracker: tracker,
          p_date: today,
          p_value: 1,
          p_id: crypto.randomUUID(),
        })
      ).error,
    ).not.toBeNull();
  });
});
