"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { type Tracker, type Log } from "@/features/tracker-engine/engine";
import {
  archiveTracker,
  recordLog,
  deleteLog,
  updateLog,
} from "@/features/trackers/actions";
import { Calendar } from "@/components/dashboard/activity";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
export function TrackerHistory({
  tracker,
  logs,
  today,
  theme,
  onClose,
  onEdit,
}: {
  tracker: Tracker;
  logs: Log[];
  today: string;
  theme: string;
  onClose: () => void;
  onEdit: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string>();
  const [date, setDate] = useState(today);
  const [value, setValue] = useState("");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const entries = logs
    .filter((l) => l.tracker_id === tracker.id)
    .sort(
      (a, b) =>
        b.tracking_date.localeCompare(a.tracking_date) ||
        b.created_at.localeCompare(a.created_at),
    );
  async function result(promise: ReturnType<typeof deleteLog>) {
    const r = await promise;
    if (r.error) setError(r.error);
    else router.refresh();
  }
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent data-theme={theme} className="dialog-scroll">
        <DialogHeader>
          <DialogTitle>{tracker.name}</DialogTitle>
          <DialogDescription>
            {tracker.archived_at
              ? "Archived · your history is preserved"
              : `${tracker.type} · ${tracker.goal_period} progress`}
          </DialogDescription>
        </DialogHeader>
        <Calendar tracker={tracker} logs={logs} date={date} today={today} />
        {!tracker.archived_at && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setError("");
              start(async () => {
                const input = {
                  tracker_id: tracker.id,
                  date,
                  value:
                    tracker.type === "habit"
                      ? 1
                      : Number(value) * (tracker.type === "duration" ? 60 : 1),
                  request_id: requestId,
                };
                const r = editing
                  ? await updateLog(editing, input)
                  : await recordLog(input);
                if (r.error) setError(r.error);
                else {
                  setValue("");
                  setEditing(undefined);
                  setRequestId(crypto.randomUUID());
                  router.refresh();
                }
              });
            }}
          >
            <FieldGroup>
              <div className="form-grid">
                <Field>
                  <FieldLabel htmlFor="log-date">Activity date</FieldLabel>
                  <Input
                    id="log-date"
                    type="date"
                    value={date}
                    max={today}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </Field>
                {tracker.type !== "habit" && (
                  <Field>
                    <FieldLabel htmlFor="log-value">
                      {tracker.type === "duration" ? "Minutes" : "Value"}
                    </FieldLabel>
                    <Input
                      id="log-value"
                      type="number"
                      min="0"
                      step="any"
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      required
                    />
                  </Field>
                )}
              </div>
              <Button size="sm" type="submit" disabled={pending}>
                {editing ? "Save entry" : "Add entry"}
              </Button>
              {editing && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setEditing(undefined);
                    setValue("");
                  }}
                >
                  Cancel edit
                </Button>
              )}
            </FieldGroup>
          </form>
        )}
        {error && (
          <p role="alert" className="text-destructive text-xs">
            {error}
          </p>
        )}
        <div>
          <h3 className="font-semibold mb-2">History</h3>
          {entries.length === 0 ? (
            <p className="muted text-sm">
              No check-ins yet. Your story starts with one.
            </p>
          ) : (
            entries.map((log) => (
              <div key={log.id} className="history-row">
                <time>{log.tracking_date}</time>
                <span>
                  {tracker.type === "habit"
                    ? "Completed"
                    : `${tracker.type === "duration" ? log.value / 60 : log.value} ${tracker.type === "duration" ? "min" : tracker.unit}`}
                </span>
                {!tracker.archived_at && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Edit entry on ${log.tracking_date}`}
                    disabled={pending}
                    onClick={() => {
                      setEditing(log.id);
                      setDate(log.tracking_date);
                      setValue(
                        String(
                          tracker.type === "duration"
                            ? log.value / 60
                            : log.value,
                        ),
                      );
                    }}
                  >
                    <Pencil size={14} />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete entry on ${log.tracking_date}`}
                  disabled={pending}
                  onClick={() => start(() => result(deleteLog(log.id)))}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))
          )}
        </div>
        {!tracker.archived_at && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={onEdit}>
              Edit tracker
            </Button>
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await archiveTracker(tracker.id);
                  if (r.error) setError(r.error);
                  else {
                    router.refresh();
                    onClose();
                  }
                })
              }
            >
              Archive tracker
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
