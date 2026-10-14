export type TrackerType = "habit" | "counter" | "duration" | "numeric";
export type Period = "daily" | "weekly" | "monthly";
export interface Tracker {
  id: string;
  name: string;
  description: string;
  type: TrackerType;
  target: number | null;
  unit: string;
  goal_period: Period;
  schedule: number[];
  icon: string;
  color: string;
  archived_at: string | null;
  created_at: string;
  created_date?: string;
}
export interface Log {
  id: string;
  tracker_id: string;
  tracking_date: string;
  value: number;
  created_at: string;
}
export function dateInTimezone(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export function periodDates(date: string, period: Period): string[] {
  const day = new Date(`${date}T12:00:00Z`);
  if (period === "daily") return [date];
  if (period === "weekly") {
    const start = shiftDate(date, -((day.getUTCDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => shiftDate(start, i));
  }
  const start = `${date.slice(0, 7)}-01`;
  const count = new Date(
    Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return Array.from({ length: count }, (_, i) => shiftDate(start, i));
}
export function isScheduled(tracker: Tracker, date: string): boolean {
  return (
    date >= (tracker.created_date ?? tracker.created_at.slice(0, 10)) &&
    tracker.schedule.includes(new Date(`${date}T12:00:00Z`).getUTCDay())
  );
}
export function aggregate(type: TrackerType, logs: Log[]): number {
  if (type === "habit")
    return new Set(logs.filter((l) => l.value > 0).map((l) => l.tracking_date))
      .size;
  if (type === "numeric")
    return (
      [...logs].sort(
        (a, b) =>
          b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id),
      )[0]?.value ?? 0
    );
  return logs.reduce((sum, l) => sum + l.value, 0);
}
export function progress(
  tracker: Tracker,
  logs: Log[],
  date: string,
  asOf = date,
) {
  if (date > asOf)
    return { value: 0, ratio: 0, complete: false, hasLogs: false };
  const dates = new Set(
    periodDates(date, tracker.goal_period).filter((d) =>
      isScheduled(tracker, d),
    ),
  );
  const matching = logs.filter(
    (l) =>
      l.tracker_id === tracker.id &&
      dates.has(l.tracking_date) &&
      l.tracking_date <= date,
  );
  const value = aggregate(tracker.type, matching);
  const ratio =
    tracker.target && matching.length
      ? Math.max(0, Math.min(1, value / tracker.target))
      : 0;
  return {
    value,
    ratio,
    complete:
      tracker.target !== null && matching.length > 0 && value >= tracker.target,
    hasLogs: matching.length > 0,
  };
}
export function activityDays(
  trackers: Tracker[],
  logs: Log[],
  dates: string[],
) {
  return dates.map((date) => {
    const scheduled = trackers.filter(
      (t) => t.target !== null && isScheduled(t, date),
    );
    return {
      date,
      completed: scheduled.filter((t) => progress(t, logs, date).complete)
        .length,
      total: scheduled.length,
    };
  });
}
