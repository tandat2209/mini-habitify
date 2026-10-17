"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { AppearanceScope } from "@/components/appearance/appearance-scope";
import { RecordedDetails } from "@/components/activity-templates/recorded-details";
import { Brand } from "@/components/shell/brand";
import { Button } from "@/components/ui/button";
import { shiftDate, periodDates } from "@/features/tracker-engine/engine";
import type { ReviewData } from "@/features/review/queries";

function dateLabel(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}
function amount(
  value: number | null,
  tracker: ReviewData["rows"][number]["tracker"],
) {
  if (value === null) return "No measurement";
  const number = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(tracker.type === "duration" ? value / 60 : value);
  const unit =
    tracker.type === "duration"
      ? "min"
      : tracker.type === "habit"
        ? Math.abs(value) === 1
          ? "day"
          : "days"
        : tracker.unit;
  return `${number}${unit ? ` ${unit}` : ""}`;
}

import { ComparisonChart, ChartData } from "./review-charts";

function ReviewCard({
  row,
  versions,
}: {
  row: ReviewData["rows"][number];
  versions: ReviewData["versions"];
}) {
  const [visible, setVisible] = useState(20);
  const { tracker, summary, entries } = row;
  const { current, previous, delta } = summary;
  const points = summary.days.map((day) => ({
    ...day,
    current:
      tracker.type === "duration" && day.current !== null
        ? day.current / 60
        : day.current,
    previous:
      tracker.type === "duration" && day.previous !== null
        ? day.previous / 60
        : day.previous,
  }));
  const chartValue = (value: number) =>
    amount(tracker.type === "duration" ? value * 60 : value, tracker);
  return (
    <article
      className="panel review-card"
      aria-labelledby={`review-${tracker.id}`}
    >
      <div className="review-card-heading">
        <h2 id={`review-${tracker.id}`}>{tracker.name}</h2>
        <div className="review-card-actions">
          {tracker.archived_at && (
            <span className="review-badge">Archived</span>
          )}
          <Link
            href={`/today/trackers/${tracker.id}`}
            className="review-history"
            aria-label={`Open ${tracker.name} history`}
          >
            <ArrowUpRight size={18} />
          </Link>
        </div>
      </div>
      <div className="review-metric">
        <div>
          <p className="review-value">{amount(current.value, tracker)}</p>
          <span className="muted text-xs">
            {tracker.type === "numeric" ? "Latest" : "Total"}
          </span>
        </div>
        {delta !== null && (
          <span
            className="review-delta"
            title={`Last week: ${amount(previous.value, tracker)}`}
          >
            <span className="sr-only">Change from last week: </span>
            {delta > 0 ? "+" : ""}
            {amount(delta, tracker)}
          </span>
        )}
      </div>
      <figure aria-label={`${tracker.name} daily comparison`}>
        <ComparisonChart
          points={points}
          numeric={tracker.type === "numeric"}
          integers={tracker.type === "habit"}
          formatValue={chartValue}
        />
      </figure>
      <div className="review-goals">
        {current.completedDays !== null && current.eligibleDays > 0 && (
          <div>
            <div className="review-goal-label">
              <span>Daily goals</span>
              <strong>
                {current.completedDays} / {current.eligibleDays} days
              </strong>
            </div>
            <progress
              value={current.completedDays / current.eligibleDays}
              max={1}
              aria-label={`${tracker.name} daily goal progress`}
            />
          </div>
        )}
        {current.goals.map((goal) => (
          <div key={goal.period}>
            <div className="review-goal-label">
              <span>
                {tracker.goal_period === "monthly"
                  ? goal.period
                  : "Weekly goal"}
                {goal.complete ? " ✓" : ""}
              </span>
              <strong>
                {tracker.type === "numeric" && !goal.hasLogs
                  ? "—"
                  : new Intl.NumberFormat("en-US", {
                      maximumFractionDigits: 2,
                    }).format(
                      tracker.type === "duration"
                        ? goal.value / 60
                        : goal.value,
                    )}{" "}
                / {amount(goal.target, tracker)}
              </strong>
            </div>
            <progress
              value={goal.ratio}
              max={1}
              aria-label={`${tracker.name} ${goal.period} goal progress`}
            />
          </div>
        ))}
      </div>
      <ChartData points={points} formatValue={chartValue} />
      {entries.length > 0 ? (
        <details className="review-entries">
          <summary>
            View {entries.length} {entries.length === 1 ? "entry" : "entries"}
          </summary>
          <ol>
            {entries.slice(0, visible).map((entry) => (
              <li key={entry.id}>
                <div className="review-entry-heading">
                  <time dateTime={entry.tracking_date}>
                    {dateLabel(entry.tracking_date)}
                  </time>
                  <strong>{amount(entry.value, tracker)}</strong>
                </div>
                <RecordedDetails
                  version={versions.find(
                    (version) => version.id === entry.template_version_id,
                  )}
                  details={entry.details}
                />
              </li>
            ))}
          </ol>
          {entries.length > visible && (
            <Button
              variant="outline"
              onClick={() => setVisible((count) => count + 20)}
            >
              Show more entries
            </Button>
          )}
          <Link
            href={`/today/trackers/${tracker.id}`}
            className="review-text-link"
          >
            History <ArrowUpRight size={14} />
          </Link>
        </details>
      ) : (
        <p className="muted text-sm review-no-entries">No entries</p>
      )}
    </article>
  );
}

export function WeeklyReview({ data }: { data: ReviewData }) {
  const { window, preferences } = data;
  const overview = periodDates(window.start, "weekly").map((date, index) => ({
    date,
    previousDate: shiftDate(date, -7),
    current:
      date > window.cutoff
        ? null
        : data.rows.reduce(
            (count, row) => count + row.summary.days[index].currentCount,
            0,
          ),
    previous:
      shiftDate(date, -7) > window.previousEnd
        ? null
        : data.rows.reduce(
            (count, row) => count + row.summary.days[index].previousCount,
            0,
          ),
  }));
  const count = data.rows.reduce(
    (total, row) => total + row.summary.current.entryCount,
    0,
  );
  const weekLabel = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })
    .formatRange(
      new Date(`${window.start}T12:00:00Z`),
      new Date(`${window.end}T12:00:00Z`),
    )
    .replace(/\s+/g, " ");
  return (
    <AppearanceScope
      theme={preferences.theme}
      primaryColor={preferences.primary_color}
      layout={preferences.layout}
      presentation={preferences.presentation}
    >
      <header className="detail-header">
        <Brand />
        <Button asChild variant="ghost">
          <Link href="/today">
            <ArrowLeft />
            Back to Today
          </Link>
        </Button>
      </header>
      <main className="review-page">
        <section className="review-intro">
          <div>
            <p className="eyebrow">The bigger picture</p>
            <h1>Weekly review</h1>
          </div>
          <span className="review-badge">
            {window.inProgress ? "In progress" : "Completed week"}
          </span>
        </section>
        <section className="review-week" aria-label="Review week">
          <h2>{weekLabel}</h2>
          <nav aria-label="Week navigation" className="review-week-nav">
            <Button
              asChild
              variant="outline"
              size="icon"
              aria-label="Previous week"
            >
              <Link href={`/review?week=${shiftDate(window.start, -7)}`}>
                <ChevronLeft />
              </Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/review">Back to this week</Link>
            </Button>
            {window.inProgress ? (
              <Button
                variant="outline"
                size="icon"
                aria-label="Next week"
                disabled
              >
                <ChevronRight />
              </Button>
            ) : (
              <Button
                asChild
                variant="outline"
                size="icon"
                aria-label="Next week"
              >
                <Link href={`/review?week=${shiftDate(window.start, 7)}`}>
                  <ChevronRight />
                </Link>
              </Button>
            )}
          </nav>
        </section>
        {data.rows.length > 0 ? (
          <>
            <section
              className="panel review-overview"
              aria-label="Weekly check-ins"
            >
              <div className="review-overview-heading">
                <div>
                  <h2>Check-ins</h2>
                  <p>
                    <strong>{count}</strong>
                    <span className="muted text-sm"> this week</span>
                  </p>
                </div>
                <div className="review-legend">
                  <span>
                    <i />
                    This week
                  </span>
                  <span>
                    <i />
                    Last week
                  </span>
                </div>
              </div>
              <ComparisonChart points={overview} height={200} integers />
              <ChartData points={overview} />
            </section>
            <div className="review-grid">
              {data.rows.map((row) => (
                <ReviewCard
                  key={`${window.start}-${row.tracker.id}`}
                  row={row}
                  versions={data.versions}
                />
              ))}
            </div>
            <details className="review-method">
              <summary>About this review</summary>
              <p>
                {data.timezone} ·{" "}
                {window.inProgress
                  ? `Through ${dateLabel(window.cutoff)}, today so far.`
                  : "Monday–Sunday."}{" "}
                Compared with {dateLabel(window.previousStart)} –{" "}
                {dateLabel(window.previousEnd)}. In-progress weeks compare
                matching weekdays, including the full previous comparison day.
                Goals use current settings; monthly goals include earlier
                entries in that month. Activity charts preserve recorded entries
                after schedule changes. Missing measurements and future days
                stay blank. Check-in counts include the trackers shown here.
              </p>
            </details>
          </>
        ) : (
          <section className="panel review-empty">
            <h2>A fresh page for your week.</h2>
            <p className="muted">No activity yet.</p>
            <Button asChild>
              <Link href="/today">Go to Today</Link>
            </Button>
          </section>
        )}
      </main>
    </AppearanceScope>
  );
}
