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
import { progress } from "@/features/tracker-engine/engine";
import { DetailsFields } from "@/components/activity-templates/details-fields";
import {
  currentTemplateVersion,
  type ActivityTracker,
  type ActivityLog,
  type TemplateData,
} from "@/features/activity-templates/types";
import type { Details } from "@/features/activity-templates/validation";
import { recordLog, deleteLog, updateLog } from "@/features/trackers/actions";
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
  templateData,
}: {
  tracker: ActivityTracker;
  logs: ActivityLog[];
  templateData: TemplateData;
  today: string;
  onDetails: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [entry, setEntry] = useState(false);
  const [value, setValue] = useState("");
  const [requestId, setRequestId] = useState("");
  const [details, setDetails] = useState<Details>({});
  const [editingId, setEditingId] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const p = progress(tracker, logs, today);
  const todayLog = logs.find(
    (l) => l.tracker_id === tracker.id && l.tracking_date === today,
  );
  const editingLog = logs.find((l) => l.id === editingId);
  const version = editingLog
    ? templateData.templateVersions.find(
        (v) => v.id === editingLog.template_version_id,
      )
    : currentTemplateVersion(tracker, templateData);
  const canAddDetails =
    tracker.type === "habit" && todayLog
      ? !!todayLog.template_version_id
      : !!currentTemplateVersion(tracker, templateData);
  function openEntry(withDetails = false) {
    setError("");
    setFieldErrors({});
    setRequestId(crypto.randomUUID());
    const log = withDetails && tracker.type === "habit" ? todayLog : undefined;
    setEditingId(log?.id);
    setDetails(log?.details ?? {});
    setValue("");
    setEntry(true);
  }
  const Icon = icons[tracker.icon as keyof typeof icons] ?? Sparkles;
  function mutate(undo = false) {
    setError("");
    start(async () => {
      const input = {
        tracker_id: tracker.id,
        date: today,
        value:
          tracker.type === "habit"
            ? 1
            : Number(value) * (tracker.type === "duration" ? 60 : 1),
        request_id: requestId || crypto.randomUUID(),
        ...(entry ? { details, template_version_id: version?.id ?? null } : {}),
      };
      const result =
        undo && todayLog
          ? await deleteLog(todayLog.id)
          : editingId && entry
            ? await updateLog(editingId, input)
            : await recordLog(input);
      if (result.error) {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
      } else {
        setEntry(false);
        setDetails({});
        setEditingId(undefined);
        setFieldErrors({});
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
              openEntry();
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
      {canAddDetails && !entry && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => openEntry(true)}
          disabled={pending}
        >
          {tracker.type === "habit" &&
          todayLog &&
          Object.keys(todayLog.details).length
            ? "Edit details"
            : "Add details"}
        </Button>
      )}
      {entry && (
        <form
          className="entry-inputs"
          onSubmit={(e) => {
            e.preventDefault();
            mutate();
          }}
        >
          {tracker.type !== "habit" && (
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
          )}
          {version && (
            <DetailsFields
              fields={version.fields}
              value={details}
              onChange={setDetails}
              errors={fieldErrors}
            />
          )}
          <Button size="sm" disabled={pending} type="submit">
            {editingId
              ? "Save details"
              : tracker.type === "habit"
                ? "Save check-in"
                : "Add"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            type="button"
            onClick={() => {
              setEntry(false);
              setDetails({});
              setEditingId(undefined);
              setFieldErrors({});
              setError("");
            }}
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
