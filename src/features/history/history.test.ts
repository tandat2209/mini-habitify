import { expect, it } from "vitest";
import { shiftMonth, historySeries, filterHistory } from "./history";
import type { Tracker, Log } from "../tracker-engine/engine";
const tracker: Tracker = {
  id: "t",
  name: "Pages",
  description: "",
  type: "counter",
  target: 10,
  unit: "pages",
  goal_period: "daily",
  schedule: [0, 1, 2, 3, 4, 5, 6],
  icon: "book",
  color: "sage",
  archived_at: null,
  created_at: "2026-01-01T00:00:00Z",
};
const logs: Log[] = [
  {
    id: "a",
    tracker_id: "t",
    tracking_date: "2026-02-10",
    value: 2,
    created_at: "2026-02-10T10:00:00Z",
  },
  {
    id: "b",
    tracker_id: "t",
    tracking_date: "2026-02-10",
    value: 3,
    created_at: "2026-02-10T11:00:00Z",
  },
];
it("navigates months across year boundaries without overflow", () =>
  expect(shiftMonth("2026-01-31", -1)).toBe("2025-12-01"));
it("uses engine aggregation for daily history charts", () => {
  expect(
    historySeries(tracker, logs, "2026-02-01", "2026-02-28").find(
      (p) => p.date === "2026-02-10",
    )?.value,
  ).toBe(5);
  expect(
    historySeries(
      { ...tracker, type: "numeric" },
      logs,
      "2026-02-01",
      "2026-02-28",
    ).find((p) => p.date === "2026-02-10")?.value,
  ).toBe(3);
});
it("keeps missing measurements empty and future days out of charts", () => {
  const series = historySeries(
    { ...tracker, type: "numeric" },
    logs,
    "2026-02-01",
    "2026-02-12",
  );
  expect(series).toHaveLength(12);
  expect(series[0].value).toBeNull();
});
it("filters logs by inclusive dates and preserves newest-first ordering", () => {
  expect(filterHistory(logs, "2026-02-11", "")).toEqual([]);
  expect(
    filterHistory(logs, "2026-02-10", "2026-02-10").map((l) => l.id),
  ).toEqual(["b", "a"]);
});
it("does not invent activity before the tracker was created", () => {
  const points = historySeries(
    {
      ...tracker,
      created_at: "2026-02-10T00:00:00Z",
      created_date: "2026-02-10",
    },
    logs,
    "2026-02-01",
    "2026-02-12",
  );
  expect(points).toHaveLength(3);
  expect(points[0].date).toBe("2026-02-10");
});
