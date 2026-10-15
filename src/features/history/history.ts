import {
  aggregate,
  periodDates,
  type Tracker,
  type Log,
} from "../tracker-engine/engine";
export function shiftMonth(date: string, amount: number): string {
  const value = new Date(`${date.slice(0, 7)}-01T12:00:00Z`);
  value.setUTCMonth(value.getUTCMonth() + amount);
  return value.toISOString().slice(0, 10);
}
export function historySeries(
  tracker: Tracker,
  logs: Log[],
  month: string,
  today: string,
): { date: string; value: number | null }[] {
  return periodDates(month, "monthly")
    .filter(
      (date) =>
        date <= today &&
        date >= (tracker.created_date ?? tracker.created_at.slice(0, 10)),
    )
    .map((date) => {
      const daily = logs.filter(
        (l) => l.tracker_id === tracker.id && l.tracking_date === date,
      );
      const value =
        tracker.type === "numeric" && daily.length === 0
          ? null
          : aggregate(tracker.type, daily);
      return {
        date,
        value:
          tracker.type === "duration" && value !== null ? value / 60 : value,
      };
    });
}
export function filterHistory<T extends Log>(
  logs: T[],
  from: string,
  to: string,
): T[] {
  return logs
    .filter(
      (l) =>
        (!from || l.tracking_date >= from) && (!to || l.tracking_date <= to),
    )
    .sort(
      (a, b) =>
        b.tracking_date.localeCompare(a.tracking_date) ||
        b.created_at.localeCompare(a.created_at) ||
        b.id.localeCompare(a.id),
    );
}
