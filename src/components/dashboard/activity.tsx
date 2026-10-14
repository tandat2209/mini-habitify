import { Star, Check } from "lucide-react";
import {
  activityDays,
  shiftDate,
  periodDates,
  progress,
  type Tracker,
  type Log,
} from "@/features/tracker-engine/engine";
export function ProgressRing({ ratio }: { ratio: number }) {
  return (
    <svg
      className="progress-ring"
      viewBox="0 0 64 64"
      role="img"
      aria-label={`${Math.round(ratio * 100)} percent complete`}
    >
      <circle
        cx="32"
        cy="32"
        r="26"
        fill="none"
        stroke="var(--muted)"
        strokeWidth="5"
      />
      <circle
        cx="32"
        cy="32"
        r="26"
        fill="none"
        stroke="var(--primary)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={`${ratio * 163.36} 163.36`}
      />
    </svg>
  );
}
export function Activity({
  trackers,
  logs,
  today,
  presentation,
}: {
  trackers: Tracker[];
  logs: Log[];
  today: string;
  presentation: string;
}) {
  const dates = Array.from(
    { length: presentation === "playful" ? 7 : 182 },
    (_, i) => shiftDate(today, i - (presentation === "playful" ? 6 : 181)),
  );
  const days = activityDays(trackers, logs, dates);
  return (
    <section className="panel">
      <div className="panel-title">
        <h2>
          {presentation === "developer"
            ? "Activity graph"
            : presentation === "playful"
              ? "Your little steps"
              : "A little, often"}
        </h2>
        <span>
          {presentation === "playful" ? "This week" : "Last 26 weeks"}
        </span>
      </div>
      {presentation === "playful" ? (
        <div className="daily-path">
          {days.map((day) => (
            <div className="path-step" key={day.date}>
              <div
                className="path-bubble"
                data-complete={day.completed > 0}
                title={`${day.date}: ${day.completed} of ${day.total} goals completed`}
              >
                {day.completed > 0 ? (
                  <Star size={20} fill="currentColor" aria-hidden />
                ) : (
                  <span aria-hidden>·</span>
                )}
              </div>
              <span>
                {new Date(`${day.date}T12:00:00Z`).toLocaleDateString("en-US", {
                  weekday: "short",
                  timeZone: "UTC",
                })}
              </span>
              <span className="sr-only">
                {day.completed} of {day.total} goals completed
              </span>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div
            className="heatmap"
            role="img"
            aria-label="Daily completion activity for the last 26 weeks"
          >
            {days.map((day) => (
              <div
                key={day.date}
                className="heat-cell"
                data-level={
                  day.total ? Math.ceil((day.completed / day.total) * 4) : 0
                }
                title={`${day.date}: ${day.completed} of ${day.total} goals completed`}
              >
                <span className="sr-only">
                  {day.date}: {day.completed} of {day.total} goals completed
                </span>
              </div>
            ))}
          </div>
          <div className="heat-legend">
            Less{" "}
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className="heat-cell" data-level={i} />
            ))}{" "}
            More
          </div>
        </>
      )}
      <p className="muted text-xs mt-4">
        {presentation === "playful"
          ? "Every check-in is a small step. Keep going at your pace."
          : "Each day shows the share of scheduled goals completed."}
      </p>
    </section>
  );
}
export function Calendar({
  tracker,
  logs,
  date,
  today,
}: {
  tracker: Tracker;
  logs: Log[];
  date: string;
  today: string;
}) {
  const days = periodDates(date, "monthly");
  const offset = (new Date(`${days[0]}T12:00:00Z`).getUTCDay() + 6) % 7;
  return (
    <div className="calendar-grid" aria-label="This month’s progress">
      {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
        <span key={i} className="muted text-center text-xs">
          {d}
        </span>
      ))}
      {Array.from({ length: offset }, (_, i) => (
        <span key={`space${i}`} />
      ))}
      {days.map((d) => {
        const p = progress(tracker, logs, d, today);
        return (
          <div
            key={d}
            className="calendar-day"
            data-complete={p.complete}
            title={`${d}: ${p.value} ${tracker.unit}`}
          >
            <span>{Number(d.slice(-2))}</span>
            {p.complete && (
              <Check size={10} className="inline ml-1" aria-label="Complete" />
            )}
          </div>
        );
      })}
    </div>
  );
}
