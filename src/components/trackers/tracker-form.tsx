"use client";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import {
  trackerSchema,
  type TrackerInput,
} from "@/features/trackers/validation";
import { saveTracker } from "@/features/trackers/actions";
import type { Tracker } from "@/features/tracker-engine/engine";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
  FieldSet,
  FieldLegend,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
const defaults: TrackerInput = {
  name: "",
  description: "",
  type: "habit",
  target: 1,
  unit: "",
  goal_period: "daily",
  schedule: [0, 1, 2, 3, 4, 5, 6],
  icon: "spark",
  color: "sage",
};
export function TrackerForm({
  open,
  onOpenChange,
  tracker,
  theme,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tracker?: Tracker;
  theme: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TrackerInput>({
    resolver: zodResolver(trackerSchema),
    defaultValues: tracker ? trackerSchema.parse(tracker) : defaults,
  });
  const type = useWatch({ control, name: "type" });
  const period = useWatch({ control, name: "goal_period" });
  const target = useWatch({ control, name: "target" });
  const schedule = useWatch({ control, name: "schedule" });
  async function submit(data: TrackerInput) {
    setError("");
    const result = await saveTracker(data, tracker?.id);
    if (result.error) setError(result.error);
    else {
      onOpenChange(false);
      router.refresh();
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-theme={theme} className="dialog-scroll">
        <DialogHeader>
          <DialogTitle>
            {tracker ? "Edit tracker" : "Make room for something good."}
          </DialogTitle>
          <DialogDescription>
            {tracker
              ? "Update your tracker. Goal and schedule changes also affect historical progress."
              : "A small habit, a big idea, or anything in between."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(submit)} className="dialog-form">
          <FieldGroup>
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="tracker-name">Name</FieldLabel>
              <Input
                id="tracker-name"
                placeholder="Read a chapter"
                {...register("name")}
                aria-invalid={!!errors.name}
              />
              <FieldError errors={[errors.name]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="description">Description</FieldLabel>
              <Textarea
                id="description"
                placeholder="Why does this matter to you?"
                {...register("description")}
              />
            </Field>
            <div className="form-grid">
              <Field>
                <FieldLabel htmlFor="type">Tracker type</FieldLabel>
                <select
                  className="native-select"
                  id="type"
                  value={type}
                  disabled={!!tracker}
                  onChange={(e) => {
                    const value = e.target.value as TrackerInput["type"];
                    setValue("type", value);
                    setValue(
                      "target",
                      value === "habit" ? 1 : value === "duration" ? 1200 : 10,
                    );
                    setValue("unit", value === "duration" ? "seconds" : "");
                  }}
                >
                  <option value="habit">Habit · yes or no</option>
                  <option value="counter">Counter · add it up</option>
                  <option value="duration">Duration · time spent</option>
                  <option value="numeric">Numeric · a measurement</option>
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor="period">Goal period</FieldLabel>
                <select
                  className="native-select"
                  id="period"
                  {...register("goal_period")}
                  onChange={(e) => {
                    const p = e.target.value as TrackerInput["goal_period"];
                    setValue("goal_period", p);
                    if (type === "habit")
                      setValue(
                        "target",
                        p === "daily" ? 1 : p === "weekly" ? 5 : 20,
                      );
                  }}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </Field>
              <Field data-invalid={!!errors.target}>
                <FieldLabel htmlFor="target">
                  Target {type === "duration" ? "(seconds)" : ""}
                </FieldLabel>
                <Input
                  id="target"
                  type="number"
                  min="0.000001"
                  step={type === "habit" ? "1" : "any"}
                  disabled={
                    target === null || (type === "habit" && period === "daily")
                  }
                  value={target ?? ""}
                  onChange={(e) =>
                    setValue(
                      "target",
                      e.target.value === "" ? null : Number(e.target.value),
                    )
                  }
                />
                <FieldError errors={[errors.target]} />
                {type !== "habit" && (
                  <label className="weekday">
                    <input
                      type="checkbox"
                      checked={target === null}
                      onChange={(e) =>
                        setValue("target", e.target.checked ? null : 10)
                      }
                    />
                    No target
                  </label>
                )}
              </Field>
              <Field>
                <FieldLabel htmlFor="unit">Unit</FieldLabel>
                <Input
                  id="unit"
                  disabled={type === "habit" || type === "duration"}
                  {...register("unit")}
                  placeholder={
                    type === "habit"
                      ? "check-ins"
                      : type === "duration"
                        ? "seconds"
                        : "pages, glasses, kg…"
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="icon">Icon</FieldLabel>
                <select
                  id="icon"
                  className="native-select"
                  {...register("icon")}
                >
                  <option value="spark">Spark</option>
                  <option value="book">Book</option>
                  <option value="heart">Heart</option>
                  <option value="walk">Movement</option>
                  <option value="code">Code</option>
                  <option value="water">Water</option>
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor="color">Accent</FieldLabel>
                <select
                  id="color"
                  className="native-select"
                  {...register("color")}
                >
                  <option value="sage">Sage</option>
                  <option value="peach">Peach</option>
                  <option value="lavender">Lavender</option>
                  <option value="blue">Blue</option>
                </select>
              </Field>
            </div>
            <FieldSet>
              <FieldLegend>Repeat on</FieldLegend>
              <div className="weekdays">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                  (day, index) => (
                    <label className="weekday" key={day}>
                      <input
                        type="checkbox"
                        checked={schedule.includes(index)}
                        onChange={(e) =>
                          setValue(
                            "schedule",
                            e.target.checked
                              ? [...schedule, index]
                              : schedule.filter((d) => d !== index),
                            { shouldValidate: true },
                          )
                        }
                      />
                      {day}
                    </label>
                  ),
                )}
              </div>
              <FieldError errors={[errors.schedule]} />
            </FieldSet>
            {type === "numeric" && (
              <p className="muted text-xs">
                Numeric trackers use the latest measurement. A target means at
                least that value; leave it blank for weight or other
                observations.
              </p>
            )}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? "Saving…"
                : tracker
                  ? "Save tracker"
                  : "Create tracker"}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
