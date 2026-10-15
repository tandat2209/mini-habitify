import { describe, expect, it } from "vitest";
import {
  aggregate,
  progress,
  periodDates,
  dateInTimezone,
  isScheduled,
  activityDays,
  type Tracker,
  type Log,
} from "./engine";
const tracker: Tracker = {
  id: "t",
  name: "Read",
  description: "",
  type: "habit",
  target: 1,
  unit: "",
  goal_period: "daily",
  schedule: [0, 1, 2, 3, 4, 5, 6],
  icon: "book",
  color: "sage",
  archived_at: null,
  created_at: "2026-01-01T00:00:00Z",
};
const log = (date: string, value = 1, at = "2026-10-13T10:00:00Z"): Log => ({
  id: at + value,
  tracker_id: "t",
  tracking_date: date,
  value,
  created_at: at,
});
describe("tracker progress", () => {
  it("does not inflate a habit with duplicate daily entries", () =>
    expect(aggregate("habit", [log("2026-10-13"), log("2026-10-13")])).toBe(1));
  it("counts separate habit dates for a weekly goal", () =>
    expect(aggregate("habit", [log("2026-10-12"), log("2026-10-13")])).toBe(2));
  it("sums counters and duration but takes the latest numeric measurement", () => {
    const logs = [
      log("2026-10-13", 20, "2026-10-13T09:00:00Z"),
      log("2026-10-13", 3, "2026-10-13T10:00:00Z"),
    ];
    expect(aggregate("counter", logs)).toBe(23);
    expect(aggregate("duration", logs)).toBe(23);
    expect(aggregate("numeric", logs)).toBe(3);
  });
  it("preserves over-target values while capping display progress", () =>
    expect(
      progress(
        { ...tracker, type: "counter", target: 10 },
        [log("2026-10-13", 15)],
        "2026-10-13",
      ),
    ).toMatchObject({ value: 15, ratio: 1, complete: true }));
  it("does not call a targetless measurement complete", () =>
    expect(
      progress(
        { ...tracker, type: "numeric", target: null },
        [log("2026-10-13", 0)],
        "2026-10-13",
      ),
    ).toMatchObject({ value: 0, ratio: 0, complete: false }));
  it("ignores out-of-period entries and returns zero for no logs", () =>
    expect(progress(tracker, [log("2026-10-12")], "2026-10-13")).toMatchObject({
      value: 0,
      complete: false,
    }));
  it("excludes logs on unscheduled days", () =>
    expect(
      progress(
        { ...tracker, schedule: [1], goal_period: "weekly" },
        [log("2026-10-13")],
        "2026-10-13",
      ).value,
    ).toBe(0));
  it("groups heatmap data using tracker completion rather than log count", () =>
    expect(
      activityDays(
        [tracker],
        [log("2026-10-13"), log("2026-10-13")],
        ["2026-10-13"],
      )[0],
    ).toMatchObject({ date: "2026-10-13", completed: 1, total: 1 }));
});
describe("calendar semantics", () => {
  it("uses Monday weeks across year boundaries", () =>
    expect(periodDates("2026-01-01", "weekly")).toEqual([
      "2025-12-29",
      "2025-12-30",
      "2025-12-31",
      "2026-01-01",
      "2026-01-02",
      "2026-01-03",
      "2026-01-04",
    ]));
  it("supports leap-year February", () =>
    expect(periodDates("2024-02-10", "monthly")).toHaveLength(29));
  it("uses the chosen timezone near midnight and DST", () => {
    expect(
      dateInTimezone(new Date("2026-10-13T18:00:00Z"), "Asia/Ho_Chi_Minh"),
    ).toBe("2026-10-14");
    expect(
      dateInTimezone(new Date("2026-03-08T07:01:00Z"), "America/New_York"),
    ).toBe("2026-03-08");
  });
  it("honors weekdays without browser timezone dependence", () =>
    expect(isScheduled({ ...tracker, schedule: [1] }, "2026-10-12")).toBe(
      true,
    ));
});
it("does not put targetless observations in the goal denominator", () => {
  expect(
    activityDays(
      [{ ...tracker, type: "numeric", target: null }],
      [log("2026-10-13", 70)],
      ["2026-10-13"],
    )[0].total,
  ).toBe(0);
});
it("uses the tracker creation date in the user timezone", () => {
  expect(
    isScheduled(
      {
        ...tracker,
        created_at: "2026-10-13T18:00:00Z",
        created_date: "2026-10-14",
      },
      "2026-10-13",
    ),
  ).toBe(false);
});
it("does not apply later check-ins to earlier dates in a weekly goal", () => {
  expect(
    progress(
      { ...tracker, goal_period: "weekly" },
      [log("2026-10-13")],
      "2026-10-12",
    ),
  ).toMatchObject({ value: 0, complete: false });
});
it("keeps future calendar dates incomplete even if the period target is reached", () => {
  expect(
    progress(
      { ...tracker, goal_period: "weekly" },
      [log("2026-10-13")],
      "2026-10-14",
      "2026-10-13",
    ),
  ).toMatchObject({ value: 0, complete: false });
});

it("keeps structured content and template changes independent of every metric", () => {
  const basic = [
    log("2026-10-13", 2, "2026-10-13T09:00:00Z"),
    log("2026-10-13", 3, "2026-10-13T10:00:00Z"),
  ];
  const enriched = basic.map((entry) => ({
    ...entry,
    details: { amount: 999, notes: "Content only", items: ["One", "Two"] },
    template_version_id: "original-version",
  }));
  for (const type of ["habit", "counter", "duration", "numeric"] as const) {
    const configured = { ...tracker, type, target: 3 };
    const associated = { ...configured, activity_template_id: "new-template" };
    expect(aggregate(type, enriched)).toBe(aggregate(type, basic));
    expect(progress(associated, enriched, "2026-10-13")).toEqual(
      progress(configured, basic, "2026-10-13"),
    );
    expect(
      activityDays([associated], enriched, ["2026-10-12", "2026-10-13"]),
    ).toEqual(activityDays([configured], basic, ["2026-10-12", "2026-10-13"]));
  }
});
