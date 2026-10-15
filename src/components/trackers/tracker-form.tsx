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
import type {
  ActivityTracker,
  ActivityTemplate,
} from "@/features/activity-templates/types";
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
import { Select } from "@/components/ui/select";
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
  activity_template_id: null,
};
export function TrackerForm({
  open,
  onOpenChange,
  tracker,
  theme,
  templates,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tracker?: ActivityTracker;
  templates: ActivityTemplate[];
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
  const templateId = useWatch({ control, name: "activity_template_id" });
  const icon = useWatch({ control, name: "icon" });
  const color = useWatch({ control, name: "color" });
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
            <Field>
              <FieldLabel htmlFor="activity-template">
                Activity template
              </FieldLabel>
              <Select
                id="activity-template"
                value={templateId ?? ""}
                onValueChange={(value) =>
                  setValue("activity_template_id", value || null)
                }
                options={[
                  { value: "", label: "No template" },
                  ...templates.map((template) => ({
                    value: template.id,
                    label: template.name,
                  })),
                ]}
              />
              <p className="muted text-xs">
                Optional details for future entries. Existing entries keep their
                recorded template.
              </p>
            </Field>
            <div className="form-grid">
              <Field>
                <FieldLabel htmlFor="type">Tracker type</FieldLabel>
                <Select<TrackerInput["type"]>
                  id="type"
                  value={type}
                  disabled={!!tracker}
                  onValueChange={(value) => {
                    setValue("type", value);
                    setValue(
                      "target",
                      value === "habit" ? 1 : value === "duration" ? 1200 : 10,
                    );
                    setValue("unit", value === "duration" ? "seconds" : "");
                  }}
                  options={[
                    { value: "habit", label: "Habit · yes or no" },
                    { value: "counter", label: "Counter · add it up" },
                    { value: "duration", label: "Duration · time spent" },
                    { value: "numeric", label: "Numeric · a measurement" },
                  ]}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="period">Goal period</FieldLabel>
                <Select<TrackerInput["goal_period"]>
                  id="period"
                  value={period}
                  onValueChange={(period) => {
                    setValue("goal_period", period);
                    if (type === "habit")
                      setValue(
                        "target",
                        period === "daily" ? 1 : period === "weekly" ? 5 : 20,
                      );
                  }}
                  options={[
                    { value: "daily", label: "Daily" },
                    { value: "weekly", label: "Weekly" },
                    { value: "monthly", label: "Monthly" },
                  ]}
                />
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
                <Select<TrackerInput["icon"]>
                  id="icon"
                  value={icon}
                  onValueChange={(value) => setValue("icon", value)}
                  options={[
                    { value: "spark", label: "Spark" },
                    { value: "book", label: "Book" },
                    { value: "heart", label: "Heart" },
                    { value: "walk", label: "Movement" },
                    { value: "code", label: "Code" },
                    { value: "water", label: "Water" },
                  ]}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="color">Accent</FieldLabel>
                <Select<TrackerInput["color"]>
                  id="color"
                  value={color}
                  onValueChange={(value) => setValue("color", value)}
                  options={[
                    { value: "sage", label: "Sage" },
                    { value: "peach", label: "Peach" },
                    { value: "lavender", label: "Lavender" },
                    { value: "blue", label: "Blue" },
                  ]}
                />
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
