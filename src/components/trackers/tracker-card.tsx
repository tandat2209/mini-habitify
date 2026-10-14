"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  BookOpen,
  Heart,
  Footprints,
  Code2,
  Droplets,
  Check,
  Plus,
  ArrowUpRight,
} from "lucide-react";
import {
  progress,
  type Tracker,
  type Log,
} from "@/features/tracker-engine/engine";
import { recordLog, deleteLog } from "@/features/trackers/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
const icons = {
  spark: Sparkles,
  book: BookOpen,
  heart: Heart,
  walk: Footprints,
  code: Code2,
  water: Droplets,
};
export function TrackerCard({
  tracker,
  logs,
  today,
  onDetails,
}: {
  tracker: Tracker;
  logs: Log[];
  today: string;
  onDetails: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [entry, setEntry] = useState(false);
  const [value, setValue] = useState("");
  const [requestId, setRequestId] = useState("");
  const p = progress(tracker, logs, today);
  const todayLog = logs.find(
    (l) => l.tracker_id === tracker.id && l.tracking_date === today,
  );
  const Icon = icons[tracker.icon as keyof typeof icons] ?? Sparkles;
  function mutate(undo = false) {
    setError("");
    start(async () => {
      const result =
        undo && todayLog
          ? await deleteLog(todayLog.id)
          : await recordLog({
              tracker_id: tracker.id,
              date: today,
              value:
                tracker.type === "habit"
                  ? 1
                  : Number(value) * (tracker.type === "duration" ? 60 : 1),
              request_id: requestId || crypto.randomUUID(),
            });
      if (result.error) setError(result.error);
      else {
        setEntry(false);
        setValue("");
        setRequestId("");
        router.refresh();
      }
    });
  }
  return (
    <article
      className="tracker-card"
      style={
        { "--tracker-accent": `var(--${tracker.color})` } as React.CSSProperties
      }
    >
      <div className="tracker-top">
        <div className="tracker-icon">
          <Icon size={22} aria-hidden />
        </div>
        <span className="pill">{tracker.goal_period}</span>
      </div>
      <div>
        <h3>{tracker.name}</h3>
        <p className="tracker-sub">
          {tracker.description ||
            {
              habit: "A small promise to yourself",
              counter: "Little by little, it adds up",
              duration: "Make a little time",
              numeric: "Notice your everyday",
            }[tracker.type]}
        </p>
      </div>
      <div className="tracker-value">
        {tracker.type === "duration"
          ? (p.value / 60).toLocaleString()
          : p.value.toLocaleString()}
        {tracker.target !== null &&
          ` / ${tracker.type === "duration" ? tracker.target / 60 : tracker.target}`}{" "}
        {tracker.type === "habit"
          ? "check-ins"
          : tracker.type === "duration"
            ? "min"
            : tracker.unit}
        <span className="sr-only">{p.complete ? " Goal complete" : ""}</span>
      </div>
      <div className="progress-track" aria-hidden>
        <span style={{ width: `${p.ratio * 100}%` }} />
      </div>
      <div className="tracker-footer">
        <Button
          variant={
            todayLog && tracker.type === "habit" ? "secondary" : "default"
          }
          size="sm"
          disabled={pending}
          onClick={() => {
            if (tracker.type === "habit") mutate(!!todayLog);
            else {
              setRequestId(crypto.randomUUID());
              setEntry(true);
            }
          }}
        >
          {tracker.type === "habit" && todayLog ? (
            <Check data-icon="inline-start" />
          ) : (
            <Plus data-icon="inline-start" />
          )}
          {pending
            ? "Saving…"
            : tracker.type === "habit" && todayLog
              ? "Undo check-in"
              : "Check in"}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`View ${tracker.name} history`}
          onClick={onDetails}
        >
          <ArrowUpRight />
        </Button>
      </div>
      {entry && (
        <form
          className="entry-inputs"
          onSubmit={(e) => {
            e.preventDefault();
            mutate();
          }}
        >
          <Input
            aria-label={`Value for ${tracker.name}${tracker.type === "duration" ? " in minutes" : ""}`}
            type="number"
            min="0"
            step="any"
            value={value}
            required
            onChange={(e) => setValue(e.target.value)}
            placeholder={tracker.type === "duration" ? "Minutes" : "Value"}
            autoFocus
          />
          <Button size="sm" disabled={pending} type="submit">
            Add
          </Button>
          <Button
            size="sm"
            variant="ghost"
            type="button"
            onClick={() => setEntry(false)}
          >
            Cancel
          </Button>
        </form>
      )}
      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </article>
  );
}
