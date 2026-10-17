import {
  aggregate,
  isScheduled,
  periodDates,
  progress,
  shiftDate,
  type Log,
  type Tracker,
} from "../tracker-engine/engine";

export function reviewWindow(requested: string | undefined, today: string) {
  const valid =
    requested &&
    /^\d{4}-\d{2}-\d{2}$/.test(requested) &&
    requested >= "1000-01-08" &&
    requested <= today &&
    Number.isFinite(Date.parse(`${requested}T12:00:00Z`)) &&
    new Date(`${requested}T12:00:00Z`).toISOString().slice(0, 10) === requested;
  const dates = periodDates(valid ? requested : today, "weekly");
  const start = dates[0];
  const end = dates[6];
  const cutoff = end < today ? end : today;
  const previousStart = shiftDate(start, -7);
  const previousEnd = shiftDate(cutoff, -7);
  return {
    start,
    end,
    cutoff,
    previousStart,
    previousEnd,
    inProgress: end >= today,
    queryFrom: `${previousStart.slice(0, 7)}-01`,
  };
}
export type ReviewWindow = ReturnType<typeof reviewWindow>;

function summarizeWindow(
  tracker: Tracker,
  logs: Log[],
  from: string,
  to: string,
) {
  const dates = periodDates(from, "weekly").filter(
    (date) => date <= to && isScheduled(tracker, date),
  );
  const entries = logs.filter(
    (log) =>
      log.tracker_id === tracker.id &&
      log.tracking_date >= from &&
      log.tracking_date <= to &&
      log.tracking_date >=
        (tracker.created_date ?? tracker.created_at.slice(0, 10)),
  );
  const value =
    tracker.type === "numeric" && entries.length === 0
      ? null
      : aggregate(tracker.type, entries);
  const hasGoal = tracker.target !== null && !tracker.archived_at;
  const completedDays =
    hasGoal && tracker.goal_period === "daily"
      ? dates.filter((date) => progress(tracker, logs, date).complete).length
      : null;
  const endpoints =
    tracker.goal_period === "monthly"
      ? [...new Set(dates.map((date) => date.slice(0, 7)))].map((month) =>
          dates.filter((date) => date.startsWith(month)).at(-1)!,
        )
      : dates.length
        ? [dates.at(-1)!]
        : [];
  const goals =
    hasGoal && tracker.goal_period !== "daily"
      ? endpoints.map((date) => ({
          period: tracker.goal_period === "monthly" ? date.slice(0, 7) : from,
          ...progress(tracker, logs, date),
          target: tracker.target!,
        }))
      : [];
  return {
    value,
    eligibleDays: dates.length,
    completedDays,
    goals,
    entryCount: entries.length,
  };
}

export function summarizeTracker(
  tracker: Tracker,
  logs: Log[],
  window: ReviewWindow,
) {
  const current = summarizeWindow(tracker, logs, window.start, window.cutoff);
  if (
    tracker.archived_at
      ? current.entryCount === 0
      : current.eligibleDays === 0 && current.entryCount === 0
  )
    return null;
  const previous = summarizeWindow(
    tracker,
    logs,
    window.previousStart,
    window.previousEnd,
  );
  const delta =
    current.value === null ||
    previous.value === null ||
    (previous.eligibleDays === 0 && previous.entryCount === 0)
      ? null
      : current.value - previous.value;
  const created = tracker.created_date ?? tracker.created_at.slice(0, 10);
  function dayValue(date: string, cutoff: string) {
    if (date > cutoff || date < created) return { value: null, count: 0 };
    const entries = logs.filter(
      (log) => log.tracker_id === tracker.id && log.tracking_date === date,
    );
    return {
      value:
        tracker.type === "numeric" && !entries.length
          ? null
          : aggregate(tracker.type, entries),
      count: entries.length,
    };
  }
  const days = periodDates(window.start, "weekly").map((date) => {
    const previousDate = shiftDate(date, -7);
    const current = dayValue(date, window.cutoff);
    const previous = dayValue(previousDate, window.previousEnd);
    return {
      date,
      previousDate,
      current: current.value,
      previous: previous.value,
      currentCount: current.count,
      previousCount: previous.count,
    };
  });
  return { current, previous, delta, days };
}
export type TrackerReview = NonNullable<ReturnType<typeof summarizeTracker>>;
