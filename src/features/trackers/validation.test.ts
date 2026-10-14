import { expect, it } from "vitest";
import { trackerSchema, logSchema, preferencesSchema } from "./validation";
const valid = {
  name: "Read",
  description: "",
  type: "habit",
  target: 1,
  unit: "",
  goal_period: "daily",
  schedule: [1, 2, 3, 4, 5],
  icon: "book",
  color: "sage",
};
it("requires names and at least one scheduled day", () => {
  expect(trackerSchema.safeParse({ ...valid, name: " " }).success).toBe(false);
  expect(trackerSchema.safeParse({ ...valid, schedule: [] }).success).toBe(
    false,
  );
});
it("accepts fractional counters and targetless measurements", () => {
  expect(
    trackerSchema.safeParse({ ...valid, type: "numeric", target: null })
      .success,
  ).toBe(true);
  expect(
    logSchema.safeParse({
      tracker_id: "123e4567-e89b-42d3-a456-426614174000",
      date: "2026-10-13",
      value: 1.5,
      request_id: "123e4567-e89b-42d3-a456-426614174001",
    }).success,
  ).toBe(true);
});
it("rejects invalid dates and negative values", () => {
  const data = {
    tracker_id: "123e4567-e89b-42d3-a456-426614174000",
    date: "2026-02-30",
    value: 1,
    request_id: "123e4567-e89b-42d3-a456-426614174001",
  };
  expect(logSchema.safeParse(data).success).toBe(false);
  expect(
    logSchema.safeParse({ ...data, date: "2026-10-13", value: -1 }).success,
  ).toBe(false);
});
it("rejects unknown preferences and preserves independent presentation choices", () => {
  expect(
    preferencesSchema.safeParse({
      theme: "paper",
      layout: "standard",
      presentation: "playful",
      show_activity: true,
    }).success,
  ).toBe(true);
  expect(
    preferencesSchema.safeParse({
      theme: "oops",
      layout: "standard",
      presentation: "playful",
      show_activity: true,
    }).success,
  ).toBe(false);
});
