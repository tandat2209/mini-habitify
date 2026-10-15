import { expect, it } from "vitest";
import { applyExperiencePreset, moveWidget } from "./presets";
import { preferencesSchema } from "../trackers/validation";
const original = preferencesSchema.parse({
  theme: "paper",
  layout: "standard",
  presentation: "calm",
  show_activity: true,
});
it("gives developer mode a graph-first compact dashboard", () => {
  expect(applyExperiencePreset("developer", original)).toMatchObject({
    theme: "terminal",
    layout: "compact",
    presentation: "developer",
    widget_order: ["activity", "summary", "recent"],
  });
  expect(original.theme).toBe("paper");
});
it("gives playful mode a path-first dashboard with fewer distractions", () => {
  expect(applyExperiencePreset("playful", original)).toMatchObject({
    theme: "pastel",
    layout: "standard",
    presentation: "playful",
    show_recent: false,
  });
});
it("moves widgets without dropping or duplicating them", () => {
  expect(moveWidget(["summary", "activity", "recent"], "recent", -1)).toEqual([
    "summary",
    "recent",
    "activity",
  ]);
  expect(moveWidget(["summary", "activity", "recent"], "summary", -1)).toEqual([
    "summary",
    "activity",
    "recent",
  ]);
});
it("rejects duplicated or incomplete widget orders", () => {
  expect(
    preferencesSchema.safeParse({
      ...original,
      widget_order: ["summary", "summary", "recent"],
    }).success,
  ).toBe(false);
});

it("accepts Neumorphism independently of layout and experience", () => {
  const selected = preferencesSchema.safeParse({
    ...original,
    theme: "neumorphism",
    layout: "compact",
    presentation: "developer",
  });
  expect(selected.success).toBe(true);
  if (selected.success)
    expect(selected.data).toMatchObject({
      theme: "neumorphism",
      layout: "compact",
      presentation: "developer",
    });
});
