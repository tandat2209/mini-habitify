"use client";
import { useId } from "react";
import { Field, FieldLabel } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type {
  Details,
  TemplateField,
} from "@/features/activity-templates/validation";
export function DetailsFields({
  fields,
  value,
  onChange,
  errors = {},
}: {
  fields: TemplateField[];
  value: Details;
  onChange: (value: Details) => void;
  errors?: Record<string, string>;
}) {
  const prefix = useId();
  function set(key: string, next: Details[string] | undefined) {
    const updated = { ...value };
    if (
      next === undefined ||
      next === "" ||
      (Array.isArray(next) && next.length === 0)
    )
      delete updated[key];
    else updated[key] = next;
    onChange(updated);
  }
  return (
    <div className="details-fields">
      {fields.map((field) => {
        const id = `${prefix}-${field.key}`;
        const errorId = `${id}-error`;
        const common = {
          id,
          "aria-invalid": !!errors[field.key],
          "aria-describedby": errors[field.key] ? errorId : undefined,
          "aria-required": field.required,
        };
        const current = value[field.key];
        return (
          <Field key={field.key} data-invalid={!!errors[field.key]}>
            <FieldLabel htmlFor={id}>{field.label}</FieldLabel>
            <p className="muted text-xs">
              {field.required ? "Required when adding details" : "Optional"}
              {field.type === "list" ? " · One item per line" : ""}
            </p>
            {field.type === "multi_select" ? (
              <fieldset {...common} className="detail-options">
                <legend className="sr-only">{field.label}</legend>
                {field.options!.map((option) => (
                  <label className="weekday" key={option}>
                    <input
                      type="checkbox"
                      checked={
                        Array.isArray(current) && current.includes(option)
                      }
                      onChange={(e) =>
                        set(
                          field.key,
                          e.target.checked
                            ? [
                                ...(Array.isArray(current) ? current : []),
                                option,
                              ]
                            : (Array.isArray(current) ? current : []).filter(
                                (v) => v !== option,
                              ),
                        )
                      }
                    />
                    {option}
                  </label>
                ))}
              </fieldset>
            ) : field.type === "select" ? (
              <Select
                {...common}
                value={typeof current === "string" ? current : ""}
                onValueChange={(next) => set(field.key, next)}
                options={[
                  { value: "", label: "Choose an option" },
                  ...field.options!.map((option) => ({
                    value: option,
                    label: option,
                  })),
                ]}
              />
            ) : field.type === "text" ||
              field.type === "textarea" ||
              field.type === "list" ? (
              <Textarea
                {...common}
                maxLength={field.type !== "list" ? 5000 : undefined}
                value={
                  Array.isArray(current)
                    ? current.join("\n")
                    : typeof current === "string"
                      ? current
                      : ""
                }
                onChange={(e) =>
                  set(
                    field.key,
                    field.type === "list"
                      ? e.target.value === ""
                        ? undefined
                        : e.target.value.split("\n")
                      : e.target.value,
                  )
                }
              />
            ) : (
              <Input
                {...common}
                type={
                  field.type === "number" || field.type === "rating"
                    ? "number"
                    : "date"
                }
                min={field.type === "rating" ? field.config!.min : undefined}
                max={field.type === "rating" ? field.config!.max : undefined}
                step={
                  field.type === "rating"
                    ? 1
                    : field.type === "number"
                      ? "any"
                      : undefined
                }
                value={
                  typeof current === "number" || typeof current === "string"
                    ? current
                    : ""
                }
                onChange={(e) =>
                  set(
                    field.key,
                    e.target.value === ""
                      ? undefined
                      : field.type === "number" || field.type === "rating"
                        ? Number(e.target.value)
                        : e.target.value,
                  )
                }
              />
            )}
            {errors[field.key] && (
              <p id={errorId} className="text-destructive text-xs">
                {errors[field.key]}
              </p>
            )}
          </Field>
        );
      })}
      {errors.details && (
        <p className="text-destructive text-xs">{errors.details}</p>
      )}
    </div>
  );
}
