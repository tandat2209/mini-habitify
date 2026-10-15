"use client";
import { ArrowUp, ArrowDown, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  changeFieldType,
  fieldTypeLabels,
} from "@/features/activity-templates/builder";
import type { TemplateField } from "@/features/activity-templates/validation";
export function TemplateFieldEditor({
  field,
  index,
  count,
  errors,
  autoFocus,
  onChange,
  onMove,
  onRemove,
}: {
  field: TemplateField;
  index: number;
  count: number;
  errors: Record<string, string>;
  autoFocus: boolean;
  onChange: (field: TemplateField) => void;
  onMove: (direction: number) => void;
  onRemove: () => void;
}) {
  const base = `fields.${index}`;
  const labelError = errors[`${base}.label`];
  const optionsError = errors[`${base}.options`];
  const selection = field.type === "select" || field.type === "multi_select";
  return (
    <fieldset
      className="template-field-card"
      aria-label={`Field ${index + 1}`}
      data-field-key={field.key}
    >
      <div className="template-field-heading">
        <div>
          <span className="template-field-number">
            {String(index + 1).padStart(2, "0")}
          </span>
          <strong>{field.label.trim() || "Untitled field"}</strong>
        </div>
        <div className="template-field-actions">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Move field ${index + 1} up`}
            disabled={index === 0}
            onClick={() => onMove(-1)}
          >
            <ArrowUp />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Move field ${index + 1} down`}
            disabled={index === count - 1}
            onClick={() => onMove(1)}
          >
            <ArrowDown />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove field ${index + 1}`}
            onClick={onRemove}
          >
            <Trash2 />
          </Button>
        </div>
      </div>
      <div className="template-field-basics">
        <Field data-invalid={!!labelError}>
          <FieldLabel htmlFor={`${field.key}-label`}>Field label</FieldLabel>
          <Input
            id={`${field.key}-label`}
            value={field.label}
            maxLength={80}
            autoFocus={autoFocus}
            placeholder="What would you like to record?"
            aria-invalid={!!labelError}
            aria-describedby={
              labelError ? `${field.key}-label-error` : undefined
            }
            onChange={(e) => onChange({ ...field, label: e.target.value })}
          />
          <FieldError id={`${field.key}-label-error`}>{labelError}</FieldError>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${field.key}-type`}>Field type</FieldLabel>
          <Select
            id={`${field.key}-type`}
            value={field.type}
            onValueChange={(type) => onChange(changeFieldType(field, type))}
            options={Object.entries(fieldTypeLabels).map(([value, label]) => ({
              value: value as TemplateField["type"],
              label,
            }))}
          />
        </Field>
      </div>
      {selection && (
        <div className="template-options">
          <p className="template-options-label">Choices</p>
          {(field.options ?? []).map((option, optionIndex) => {
            const error =
              errors[`${base}.options.${optionIndex}`] ?? optionsError;
            return (
              <div key={optionIndex} className="template-option-row">
                <div>
                  <label
                    className="sr-only"
                    htmlFor={`${field.key}-option-${optionIndex}`}
                  >{`Option ${optionIndex + 1}`}</label>
                  <Input
                    id={`${field.key}-option-${optionIndex}`}
                    value={option}
                    maxLength={120}
                    placeholder={`Option ${optionIndex + 1}`}
                    aria-invalid={!!error}
                    aria-describedby={
                      error ? `${field.key}-options-error` : undefined
                    }
                    onChange={(e) =>
                      onChange({
                        ...field,
                        options: field.options!.map((value, i) =>
                          i === optionIndex ? e.target.value : value,
                        ),
                      })
                    }
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove option ${optionIndex + 1}`}
                  onClick={() =>
                    onChange({
                      ...field,
                      options: field.options!.filter(
                        (_, i) => i !== optionIndex,
                      ),
                    })
                  }
                >
                  <X />
                </Button>
              </div>
            );
          })}
          <FieldError id={`${field.key}-options-error`}>
            {optionsError ??
              Object.entries(errors).find(([path]) =>
                path.startsWith(`${base}.options.`),
              )?.[1]}
          </FieldError>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={(field.options?.length ?? 0) >= 50}
            onClick={() =>
              onChange({ ...field, options: [...(field.options ?? []), ""] })
            }
          >
            <Plus />
            Add option
          </Button>
        </div>
      )}
      <label className="weekday template-required">
        <input
          type="checkbox"
          checked={field.required}
          onChange={(e) => onChange({ ...field, required: e.target.checked })}
        />
        Required when adding details
      </label>
      {field.type === "list" && (
        <p className="muted text-xs">People can enter one item per line.</p>
      )}
    </fieldset>
  );
}
