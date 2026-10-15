"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { periodDates } from "@/features/tracker-engine/engine";
import {
  shiftMonth,
  historySeries,
  filterHistory,
} from "@/features/history/history";
import {
  archiveTracker,
  recordLog,
  deleteLog,
  updateLog,
} from "@/features/trackers/actions";
import { DetailsFields } from "@/components/activity-templates/details-fields";
import { RecordedDetails } from "@/components/activity-templates/recorded-details";
import {
  currentTemplateVersion,
  type ActivityTracker,
  type ActivityLog,
  type TemplateData,
} from "@/features/activity-templates/types";
import type { Details } from "@/features/activity-templates/validation";
import { Calendar } from "@/components/dashboard/activity";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
export interface HistoryProps {
  tracker: ActivityTracker;
  logs: ActivityLog[];
  templateData: TemplateData;
  today: string;
  onClose: () => void;
  onEdit: () => void;
}
export function HistoryContent({
  tracker,
  logs,
  today,
  onClose,
  onEdit,
  templateData,
}: HistoryProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string>();
  const [details, setDetails] = useState<Details>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const editingLog = logs.find((l) => l.id === editing);
  const version = editingLog
    ? templateData.templateVersions.find(
        (v) => v.id === editingLog.template_version_id,
      )
    : currentTemplateVersion(tracker, templateData);
  const [date, setDate] = useState(today);
  const [value, setValue] = useState("");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [month, setMonth] = useState(today.slice(0, 7) + "-01");
  const [from, setFrom] = useState(today.slice(0, 7) + "-01");
  const [to, setTo] = useState(today);
  const [page, setPage] = useState(0);
  const owned = logs.filter((l) => l.tracker_id === tracker.id);
  const invalidRange = !!from && !!to && from > to;
  const entries = invalidRange ? [] : filterHistory(owned, from, to);
  const pages = Math.max(1, Math.ceil(entries.length / 20));
  const displayed = entries.slice(
    Math.min(page, pages - 1) * 20,
    (Math.min(page, pages - 1) + 1) * 20,
  );
  const series = historySeries(tracker, owned, month, today);
  const hasMonthLogs = owned.some((l) =>
    l.tracking_date.startsWith(month.slice(0, 7)),
  );
  const unit =
    tracker.type === "duration"
      ? "minutes"
      : tracker.type === "habit"
        ? "check-ins"
        : tracker.unit || "value";
  function navigate(amount: number) {
    const next = shiftMonth(month, amount);
    setMonth(next);
    setFrom(next);
    const dates = periodDates(next, "monthly");
    setTo(dates[dates.length - 1] > today ? today : dates[dates.length - 1]);
    setPage(0);
  }
  async function remove(id: string) {
    const r = await deleteLog(id);
    if (r.error) setError(r.error);
    else router.refresh();
  }
  return (
    <div className="history-content">
      <section className="history-calendar">
        <div className="month-navigation">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Previous month"
            onClick={() => navigate(-1)}
          >
            <ChevronLeft />
          </Button>
          <h2>
            {new Date(month + "T12:00:00Z").toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            })}
          </h2>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Next month"
            disabled={month.slice(0, 7) >= today.slice(0, 7)}
            onClick={() => navigate(1)}
          >
            <ChevronRight />
          </Button>
        </div>
        <Calendar tracker={tracker} logs={logs} date={month} today={today} />
      </section>
      <section className="history-trend">
        <h2>
          Daily activity <span className="muted text-xs">· {unit}</span>
        </h2>
        {hasMonthLogs ? (
          <>
            <div
              className="trend-chart"
              aria-label={`Daily ${unit} for the selected month`}
            >
              <ResponsiveContainer width="100%" height={180}>
                <LineChart
                  data={series}
                  margin={{ top: 12, right: 12, left: -20, bottom: 0 }}
                >
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d) => String(Number(String(d).slice(-2)))}
                    minTickGap={28}
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                  />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      borderColor: "var(--border)",
                      color: "var(--foreground)",
                    }}
                    labelFormatter={(label) => String(label)}
                  />
                  <Line
                    type="linear"
                    dataKey="value"
                    name={unit}
                    stroke="var(--primary-ink, var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <details className="chart-data">
              <summary>View chart data</summary>
              <table>
                <caption className="sr-only">Daily activity in {unit}</caption>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>{unit}</th>
                  </tr>
                </thead>
                <tbody>
                  {series.map((point) => (
                    <tr key={point.date}>
                      <td>{point.date}</td>
                      <td>{point.value ?? "No measurement"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </>
        ) : (
          <p className="muted text-sm">No recorded activity this month.</p>
        )}
      </section>
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
                details,
                template_version_id: version?.id ?? null,
              };
              const r = editing
                ? await updateLog(editing, input)
                : await recordLog(input);
              if (r.error) {
                setError(r.error);
                setFieldErrors(r.fieldErrors ?? {});
              } else {
                setValue("");
                setEditing(undefined);
                setDetails({});
                setFieldErrors({});
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
            {version && (
              <details
                className="journal-section"
                key={editing ?? version.id}
                open={editing ? true : undefined}
              >
                <summary>
                  Activity details · version {version.version} (optional)
                </summary>
                <p className="muted text-xs">
                  You can save progress with no details. Required fields apply
                  when you add details.
                </p>
                <DetailsFields
                  fields={version.fields}
                  value={details}
                  onChange={setDetails}
                  errors={fieldErrors}
                />
                {Object.keys(details).length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDetails({});
                      setFieldErrors({});
                    }}
                  >
                    Clear details
                  </Button>
                )}
              </details>
            )}
            <Button size="sm" type="submit" disabled={pending}>
              {editing ? "Save entry" : "Add entry"}
            </Button>
            {editing && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setEditing(undefined);
                  setDetails({});
                  setFieldErrors({});
                  setError("");
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
      <section>
        <h2>History</h2>
        <div className="form-grid history-filters">
          <Field>
            <FieldLabel htmlFor="history-from">History from</FieldLabel>
            <Input
              id="history-from"
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(0);
              }}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="history-to">History to</FieldLabel>
            <Input
              id="history-to"
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(0);
              }}
            />
          </Field>
        </div>
        {invalidRange && (
          <p role="alert" className="text-destructive text-xs">
            The start date must be before the end date.
          </p>
        )}
        {entries.length === 0 ? (
          <p className="muted text-sm">No entries in this date range.</p>
        ) : (
          displayed.map((log) => (
            <div className="history-row" key={log.id}>
              <time>{log.tracking_date}</time>
              <span>
                {tracker.type === "habit"
                  ? "Completed"
                  : `${tracker.type === "duration" ? log.value / 60 : log.value} ${tracker.type === "duration" ? "min" : tracker.unit}`}
              </span>
              <div className="flex gap-1">
                {!tracker.archived_at && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Edit entry on ${log.tracking_date}`}
                    disabled={pending}
                    onClick={() => {
                      setEditing(log.id);
                      setDetails(log.details);
                      setFieldErrors({});
                      setError("");
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
                    <Pencil />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete entry on ${log.tracking_date}`}
                  disabled={pending}
                  onClick={() => start(() => remove(log.id))}
                >
                  <Trash2 />
                </Button>
              </div>
              <RecordedDetails
                version={templateData.templateVersions.find(
                  (v) => v.id === log.template_version_id,
                )}
                details={log.details}
              />
            </div>
          ))
        )}
        {pages > 1 && (
          <div className="history-pagination">
            <Button
              size="sm"
              variant="outline"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous entries
            </Button>
            <span>
              Page {Math.min(page, pages - 1) + 1} of {pages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= pages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Next entries
            </Button>
          </div>
        )}
      </section>
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
    </div>
  );
}
