import { describe, expect, it } from "vitest";
import { reviewWindow, summarizeTracker } from "./review";
import {
  dateInTimezone,
  type Log,
  type Tracker,
} from "../tracker-engine/engine";

const tracker: Tracker = {
  id: "t",
  name: "Reading",
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
function log(date: string, value = 1, createdAt = `${date}T12:00:00Z`): Log {
  return {
    id: `${date}-${createdAt}-${value}`,
    tracker_id: "t",
    tracking_date: date,
    value,
    created_at: createdAt,
  };
}
describe("weekly review", () => {
  it("builds seven matching-day chart points without future values", () => {
    const result = summarizeTracker(
      { ...tracker, type: "counter" },
      [
        log("2026-10-12", 2),
        log("2026-10-12", 3),
        log("2026-10-05", 7),
        log("2026-10-15", 100),
        log("2026-10-08", 99),
      ],
      reviewWindow(undefined, "2026-10-14"),
    );
    expect(result?.days).toHaveLength(7);
    expect(result?.days[0]).toMatchObject({
      date: "2026-10-12",
      previousDate: "2026-10-05",
      current: 5,
      previous: 7,
      currentCount: 2,
      previousCount: 1,
    });
    expect(result?.days[1].current).toBe(0);
    expect(result?.days[3]).toMatchObject({
      current: null,
      previous: null,
      currentCount: 0,
      previousCount: 0,
    });
  });
  it("charts numeric gaps and zero separately, preserving recording order", () => {
    const result = summarizeTracker(
      { ...tracker, type: "numeric", target: null, created_date: "2026-10-13" },
      [log("2026-10-13", 5), log("2026-10-13", 0, "2026-10-14T10:00:00Z")],
      reviewWindow(undefined, "2026-10-14"),
    );
    expect(result?.days[0]).toMatchObject({ current: null, previous: null });
    expect(result?.days[1]).toMatchObject({ current: 0, currentCount: 2 });
    expect(result?.days[2].current).toBeNull();
  });
  it("preserves recorded activity after a schedule edit while goals use the current schedule", () => {
    const result = summarizeTracker(
      { ...tracker, schedule: [5] },
      [log("2026-10-12")],
      reviewWindow(undefined, "2026-10-14"),
    );
    expect(result?.current).toMatchObject({
      value: 1,
      entryCount: 1,
      eligibleDays: 0,
      completedDays: 0,
    });
  });
  it("compares matching weekdays and rejects invalid/future selections", () => {
    expect(reviewWindow(undefined, "2026-10-14")).toMatchObject({
      start: "2026-10-12",
      end: "2026-10-18",
      cutoff: "2026-10-14",
      previousStart: "2026-10-05",
      previousEnd: "2026-10-07",
      inProgress: true,
    });
    expect(reviewWindow("2026-02-30", "2026-10-14").start).toBe("2026-10-12");
    expect(reviewWindow("2027-01-01", "2026-10-14").start).toBe("2026-10-12");
    expect(reviewWindow("2026-01-01", "2026-10-14")).toMatchObject({
      start: "2025-12-29",
      end: "2026-01-04",
      previousEnd: "2025-12-28",
      inProgress: false,
    });
  });
  it("uses local calendar dates across DST and timezone boundaries", () => {
    const today = dateInTimezone(
      new Date("2026-03-09T03:30:00Z"),
      "America/New_York",
    );
    expect(today).toBe("2026-03-08");
    expect(reviewWindow(undefined, today)).toMatchObject({
      start: "2026-03-02",
      cutoff: "2026-03-08",
      previousEnd: "2026-03-01",
    });
  });
  it("counts scheduled daily goals without future or pre-creation days", () => {
    const result = summarizeTracker(
      { ...tracker, created_date: "2026-10-13", schedule: [1, 2, 3, 4, 5] },
      [log("2026-10-12"), log("2026-10-13"), log("2026-10-15")],
      reviewWindow(undefined, "2026-10-14"),
    );
    expect(result?.current).toMatchObject({
      value: 1,
      eligibleDays: 2,
      completedDays: 1,
    });
    expect(result?.previous.eligibleDays).toBe(0);
  });
  it("preserves weekly habit uniqueness and raw over-target values", () => {
    const result = summarizeTracker(
      { ...tracker, target: 2, goal_period: "weekly" },
      [
        log("2026-10-12"),
        log("2026-10-12"),
        log("2026-10-13"),
        log("2026-10-14"),
      ],
      reviewWindow(undefined, "2026-10-14"),
    );
    expect(result?.current.value).toBe(3);
    expect(result?.current.goals[0]).toMatchObject({
      value: 3,
      target: 2,
      complete: true,
    });
  });
  it("sums fractional counters and canonical duration seconds", () => {
    const window = reviewWindow(undefined, "2026-10-14");
    expect(
      summarizeTracker(
        { ...tracker, type: "counter", target: null },
        [log("2026-10-12", 1.5), log("2026-10-13", 2.25), log("2026-10-05", 1)],
        window,
      ),
    ).toMatchObject({
      current: { value: 3.75, completedDays: null, goals: [] },
      delta: 2.75,
    });
    expect(
      summarizeTracker(
        { ...tracker, type: "duration" },
        [log("2026-10-12", 90), log("2026-10-13", 60)],
        window,
      )?.current.value,
    ).toBe(150);
  });
  it("keeps numeric zero, missing measurements, and engine ordering distinct", () => {
    const numeric = { ...tracker, type: "numeric" as const, target: null };
    const window = reviewWindow(undefined, "2026-10-14");
    expect(
      summarizeTracker(
        numeric,
        [log("2026-10-12", 10), log("2026-10-13", 0), log("2026-10-05", 2)],
        window,
      ),
    ).toMatchObject({ current: { value: 0 }, delta: -2 });
    expect(summarizeTracker(numeric, [], window)).toMatchObject({
      current: { value: null },
      delta: null,
    });
    expect(
      summarizeTracker(
        numeric,
        [log("2026-10-13", 5), log("2026-10-12", 3, "2026-10-14T12:00:00Z")],
        window,
      )?.current.value,
    ).toBe(3);
  });
  it("separates month contexts and fetches the previous month's full context", () => {
    const window = reviewWindow("2026-10-01", "2026-10-14");
    expect(window.queryFrom).toBe("2026-09-01");
    const result = summarizeTracker(
      { ...tracker, type: "counter", goal_period: "monthly", target: 10 },
      [
        log("2026-09-01", 5),
        log("2026-09-29", 2),
        log("2026-10-01", 3),
        log("2026-10-05", 100),
      ],
      window,
    );
    expect(result?.current.value).toBe(5);
    expect(result?.current.goals).toMatchObject([
      { period: "2026-09", value: 7, target: 10 },
      { period: "2026-10", value: 3, target: 10 },
    ]);
  });
  it("includes archived trackers only with selected-week entries and no missed goals", () => {
    const archived = { ...tracker, archived_at: "2026-10-14T12:00:00Z" };
    const window = reviewWindow(undefined, "2026-10-14");
    expect(summarizeTracker(archived, [], window)).toBeNull();
    expect(
      summarizeTracker(archived, [log("2026-10-13")], window)?.current,
    ).toMatchObject({ completedDays: null, goals: [] });
    expect(
      summarizeTracker({ ...tracker, created_date: "2026-10-15" }, [], window),
    ).toBeNull();
  });
});
