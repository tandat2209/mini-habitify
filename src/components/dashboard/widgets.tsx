import { Clock3 } from "lucide-react";
import { ProgressRing } from "./activity";
import type { Tracker, Log } from "@/features/tracker-engine/engine";
export function SummaryWidget({
  completed,
  goalCount,
  trackerCount,
  checkIns,
}: {
  completed: number;
  goalCount: number;
  trackerCount: number;
  checkIns: number;
}) {
  return (
    <section className="summary" aria-label="Today’s summary">
      <div className="summary-cell">
        <ProgressRing ratio={goalCount ? completed / goalCount : 0} />
        <div>
          <div className="summary-value">
            {completed}
            <span className="muted text-lg"> / {goalCount}</span>
          </div>
          <div className="summary-caption">goals complete today</div>
        </div>
      </div>
      <div className="summary-cell">
        <div>
          <div className="summary-value">{trackerCount}</div>
          <div className="summary-caption">things you’re making time for</div>
        </div>
      </div>
      <div className="summary-cell">
        <div>
          <div className="summary-value">{checkIns}</div>
          <div className="summary-caption">check-ins today</div>
        </div>
      </div>
    </section>
  );
}
export function RecentWidget({
  data,
}: {
  data: { trackers: Tracker[]; logs: Log[]; today: string };
}) {
  const recent = [...data.logs]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 5);
  return (
    <section className="panel">
      <div className="panel-title">
        <h2>Little moments, lately</h2>
        <Clock3 size={15} className="muted" />
      </div>
      {recent.length === 0 ? (
        <p className="muted text-sm leading-7">
          Your check-ins will find a home here.
          <br />
          Every little moment counts.
        </p>
      ) : (
        recent.map((log) => {
          const t = data.trackers.find((t) => t.id === log.tracker_id);
          return (
            <div className="activity-row" key={log.id}>
              <span className="activity-dot" />
              <div>
                <strong>{t?.name || "Tracker"}</strong>
                <div className="muted mt-1">
                  {t?.type === "habit"
                    ? "Checked in"
                    : `${t?.type === "duration" ? log.value / 60 : log.value} ${t?.type === "duration" ? "min" : t?.unit || ""}`}
                </div>
              </div>
              <time>
                {log.tracking_date === data.today ? "Today" : log.tracking_date}
              </time>
            </div>
          );
        })
      )}
    </section>
  );
}
