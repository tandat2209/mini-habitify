"use client";
import { useId, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, Plus, SlidersHorizontal } from "lucide-react";
import { publishTemplate } from "@/features/activity-templates/actions";
import {
  createDraftField,
  moveField,
} from "@/features/activity-templates/builder";
import {
  templateSchema,
  type Details,
  type TemplateDefinition,
  type TemplateField,
} from "@/features/activity-templates/validation";
import type { TemplateData } from "@/features/activity-templates/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DetailsFields } from "./details-fields";
import { TemplateFieldEditor } from "./template-field-editor";
const emptyDefinition = (): TemplateDefinition => ({
  name: "",
  description: "",
  fields: [],
});
export function TemplateLibrary({
  data,
  theme,
  onClose,
}: {
  data: TemplateData;
  theme: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const formId = useId();
  const gridRef = useRef<HTMLDivElement>(null);
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState("");
  const [draft, setDraft] = useState<TemplateDefinition>(emptyDefinition);
  const [previewValues, setPreviewValues] = useState<Details>({});
  const [view, setView] = useState<"build" | "preview">("build");
  const [focusKey, setFocusKey] = useState<string>();
  const [attempted, setAttempted] = useState(false);
  const [error, setError] = useState("");
  const [json, setJson] = useState("");
  const [jsonError, setJsonError] = useState("");
  const validation = templateSchema.safeParse(draft);
  const errors: Record<string, string> =
    attempted && !validation.success
      ? Object.fromEntries(
          validation.error.issues.map((issue) => [
            issue.path.join("."),
            issue.message,
          ]),
        )
      : {};
  const previewFields = draft.fields.map((field) => ({
    ...field,
    label: field.label.trim() || "Untitled field",
    ...(field.options
      ? {
          options: [
            ...new Set(
              field.options.filter((option) => option.trim().length > 0),
            ),
          ],
        }
      : {}),
  }));
  function showView(next: "build" | "preview") {
    setView(next);
    setFocusKey(undefined);
    gridRef.current?.scrollTo({ top: 0 });
  }
  function selectTemplate(id: string) {
    const template = data.templates.find((entry) => entry.id === id);
    const version = data.templateVersions.find(
      (entry) => entry.id === template?.current_version_id,
    );
    const next =
      template && version
        ? {
            name: template.name,
            description: template.description,
            fields: version.fields.map((field) => ({
              ...field,
              ...(field.options ? { options: [...field.options] } : {}),
            })),
          }
        : emptyDefinition();
    setSelected(id);
    setDraft(next);
    setPreviewValues({});
    setAttempted(false);
    setError("");
    setJsonError("");
    setJson(JSON.stringify(next, null, 2));
    setFocusKey(undefined);
    showView("build");
  }
  function updateField(next: TemplateField) {
    const previous = draft.fields.find((field) => field.key === next.key);
    if (
      previous?.type !== next.type ||
      JSON.stringify(previous?.options) !== JSON.stringify(next.options)
    )
      setPreviewValues((values) => {
        const remaining = { ...values };
        delete remaining[next.key];
        return remaining;
      });
    setDraft((current) => ({
      ...current,
      fields: current.fields.map((field) =>
        field.key === next.key ? next : field,
      ),
    }));
  }
  function importJson() {
    setJsonError("");
    let input: unknown;
    try {
      input = JSON.parse(json);
    } catch {
      setJsonError("Enter a valid JSON definition.");
      return;
    }
    const parsed = templateSchema.safeParse(input);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setJsonError(`${issue.path.join(".") || "Definition"}: ${issue.message}`);
      return;
    }
    setDraft(parsed.data);
    setPreviewValues({});
    setAttempted(false);
    setError("");
    setFocusKey(undefined);
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAttempted(true);
    setError("");
    if (!validation.success) {
      setView("build");
      const form = event.currentTarget;
      requestAnimationFrame(() =>
        form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
      return;
    }
    start(async () => {
      const result = await publishTemplate(
        validation.data,
        selected || undefined,
      );
      if (result.error) setError(result.error);
      else {
        router.refresh();
        onClose();
      }
    });
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent
        data-theme={theme}
        className="dialog-scroll template-builder-dialog"
      >
        <div className="template-builder-top">
          <DialogHeader>
            <DialogTitle>Activity templates</DialogTitle>
            <DialogDescription>
              Choose the details you want to remember. Build once, then reuse
              across your trackers.
            </DialogDescription>
          </DialogHeader>
          <Field className="template-library-selector">
            <FieldLabel htmlFor={`${formId}-select`}>
              Template to edit
            </FieldLabel>
            <Select
              id={`${formId}-select`}
              value={selected}
              disabled={pending}
              onValueChange={selectTemplate}
              options={[
                { value: "", label: "Create a new template" },
                ...data.templates
                  .filter((template) => !template.archived_at)
                  .map((template) => ({
                    value: template.id,
                    label: template.name,
                  })),
              ]}
            />
          </Field>
        </div>
        <div className="builder-view-switch" aria-label="Template builder view">
          <Button
            type="button"
            variant={view === "build" ? "secondary" : "ghost"}
            aria-pressed={view === "build"}
            onClick={() => showView("build")}
          >
            <SlidersHorizontal />
            Build form
          </Button>
          <Button
            type="button"
            variant={view === "preview" ? "secondary" : "ghost"}
            aria-pressed={view === "preview"}
            onClick={() => showView("preview")}
          >
            <Eye />
            Preview form
          </Button>
        </div>
        <div
          ref={gridRef}
          className="template-builder-grid"
          data-builder-view={view}
        >
          <form
            id={formId}
            className="template-editor"
            noValidate
            onSubmit={submit}
          >
            <fieldset disabled={pending} className="template-editor-content">
              <div className="template-meta">
                <Field data-invalid={!!errors.name}>
                  <FieldLabel htmlFor={`${formId}-name`}>
                    Template name
                  </FieldLabel>
                  <Input
                    id={`${formId}-name`}
                    value={draft.name}
                    maxLength={80}
                    placeholder="A little more about your day"
                    aria-invalid={!!errors.name}
                    aria-describedby={
                      errors.name ? `${formId}-name-error` : undefined
                    }
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                  />
                  <FieldError id={`${formId}-name-error`}>
                    {errors.name}
                  </FieldError>
                </Field>
                <Field data-invalid={!!errors.description}>
                  <FieldLabel htmlFor={`${formId}-description`}>
                    Template description
                  </FieldLabel>
                  <Textarea
                    id={`${formId}-description`}
                    value={draft.description}
                    maxLength={500}
                    placeholder="Optional · What will these details help you remember?"
                    aria-invalid={!!errors.description}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                  />
                  <FieldError>{errors.description}</FieldError>
                </Field>
              </div>
              <div className="template-fields-heading">
                <div>
                  <h2>Your fields</h2>
                  <p className="muted text-xs">
                    {draft.fields.length} of 30 fields
                  </p>
                </div>
                <span className="pill">You choose what matters</span>
              </div>
              {draft.fields.length === 0 && (
                <div className="template-fields-empty">
                  <Plus size={24} aria-hidden />
                  <h3>Start with one small detail.</h3>
                  <p>
                    Add a note, a number, a choice, or anything you want to
                    remember.
                  </p>
                </div>
              )}
              <FieldError>{errors.fields}</FieldError>
              {draft.fields.map((field, index) => (
                <TemplateFieldEditor
                  key={field.key}
                  field={field}
                  index={index}
                  count={draft.fields.length}
                  errors={errors}
                  autoFocus={focusKey === field.key}
                  onChange={updateField}
                  onMove={(direction) =>
                    setDraft((current) => ({
                      ...current,
                      fields: moveField(current.fields, field.key, direction),
                    }))
                  }
                  onRemove={() => {
                    setDraft((current) => ({
                      ...current,
                      fields: current.fields.filter(
                        (entry) => entry.key !== field.key,
                      ),
                    }));
                    setPreviewValues((values) => {
                      const remaining = { ...values };
                      delete remaining[field.key];
                      return remaining;
                    });
                  }}
                />
              ))}
              <Button
                type="button"
                variant="outline"
                className="template-add-field"
                disabled={draft.fields.length >= 30}
                onClick={() => {
                  const field = createDraftField(crypto.randomUUID());
                  setDraft((current) => ({
                    ...current,
                    fields: [...current.fields, field],
                  }));
                  setFocusKey(field.key);
                }}
              >
                <Plus />
                Add field
              </Button>
              <details className="template-advanced">
                <summary>Advanced JSON</summary>
                <p className="muted text-xs">
                  Import an existing definition, or load your current fields to
                  copy them as JSON. This replaces the fields in this draft.
                </p>
                <Field>
                  <FieldLabel htmlFor={`${formId}-json`}>
                    Template definition
                  </FieldLabel>
                  <Textarea
                    id={`${formId}-json`}
                    className="template-definition"
                    rows={9}
                    spellCheck={false}
                    value={json}
                    onChange={(event) => setJson(event.target.value)}
                    aria-invalid={!!jsonError}
                  />
                </Field>
                <div className="template-json-actions">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setJson(JSON.stringify(draft, null, 2));
                      setJsonError("");
                    }}
                  >
                    Load current definition
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!json.trim()}
                    onClick={importJson}
                  >
                    Import JSON
                  </Button>
                </div>
                {jsonError && (
                  <p role="alert" className="text-destructive text-xs">
                    {jsonError}
                  </p>
                )}
              </details>
            </fieldset>
          </form>
          <section className="template-preview" aria-label="Check-in preview">
            <div className="template-preview-heading">
              <span className="eyebrow">A little preview</span>
              <Eye size={18} aria-hidden />
            </div>
            <h2>{draft.name.trim() || "Your check-in form"}</h2>
            <p className="muted text-sm">
              {draft.description || "The details you add will appear here."}
            </p>
            <p className="template-preview-note">
              Try these fields. Preview entries are never saved.
            </p>
            {previewFields.length ? (
              <DetailsFields
                fields={previewFields}
                value={previewValues}
                onChange={setPreviewValues}
              />
            ) : (
              <div className="template-preview-empty">
                Add a field to see your form take shape.
              </div>
            )}
            <p className="muted text-xs template-progress-note">
              Progress can always be recorded without details. Required fields
              apply only when someone adds details.
            </p>
          </section>
        </div>
        <div className="template-builder-footer">
          <p className="muted text-xs">
            {selected
              ? "Changes apply to future check-ins. Previous entries stay unchanged."
              : "Reusable across your trackers. You can update it whenever you need."}
          </p>
          {attempted && !validation.success && (
            <p role="alert" className="text-destructive text-xs">
              Check the highlighted fields before saving.
            </p>
          )}
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <Button form={formId} type="submit" disabled={pending}>
            {pending
              ? "Saving…"
              : selected
                ? "Save changes"
                : "Create template"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
