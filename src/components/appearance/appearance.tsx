"use client";
import { ArrowUp, ArrowDown } from "lucide-react";
import {
  applyExperiencePreset,
  moveWidget,
  widgetLabels,
  type WidgetKind,
} from "@/features/themes/presets";
import { themeColors } from "@/features/themes/colors";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { savePreferences } from "@/features/trackers/actions";
import {
  themes,
  presentations,
  type Preferences,
} from "@/features/trackers/validation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
export function Appearance({
  saved,
  preview,
  onPreview,
  onClose,
}: {
  saved: Preferences;
  preview: Preferences;
  onPreview: (p: Preferences) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [colorDraft, setColorDraft] = useState(
    preview.primary_color ?? themeColors[preview.theme].primary,
  );
  const colorValid = /^#[0-9a-f]{6}$/i.test(colorDraft);
  function previewAppearance(next: Preferences) {
    onPreview(next);
    setColorDraft(next.primary_color ?? themeColors[next.theme].primary);
  }
  function chooseColor(color: string) {
    setColorDraft(color);
    if (/^#[0-9a-f]{6}$/i.test(color))
      onPreview({ ...preview, primary_color: color.toLowerCase() });
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onPreview(saved);
          onClose();
        }
      }}
    >
      <DialogContent data-theme={preview.theme} className="dialog-scroll">
        <DialogHeader>
          <DialogTitle>Make it feel like you.</DialogTitle>
          <DialogDescription>
            Try a new atmosphere, or a different way to see your progress. Your
            tracking data stays the same.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setPending(true);
            setError("");
            const result = await savePreferences(preview);
            setPending(false);
            if (result.error) setError(result.error);
            else {
              onClose();
              router.refresh();
            }
          }}
        >
          <fieldset disabled={pending}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="preset">Experience preset</FieldLabel>
                <select
                  id="preset"
                  className="native-select"
                  value=""
                  onChange={(e) => {
                    if (e.target.value)
                      previewAppearance(
                        applyExperiencePreset(
                          e.target.value as Preferences["presentation"],
                          preview,
                        ),
                      );
                  }}
                >
                  <option value="">Choose a starting point…</option>
                  <option value="calm">Calm · an editorial everyday</option>
                  <option value="developer">
                    Developer · graph first, compact trackers
                  </option>
                  <option value="playful">
                    Playful · your small-step journey
                  </option>
                </select>
                <p className="muted text-xs">
                  A preset sets your theme, layout, and widgets. You can
                  customize each below.
                </p>
              </Field>
              <Field>
                <FieldLabel htmlFor="theme">Theme</FieldLabel>
                <select
                  id="theme"
                  className="native-select"
                  value={preview.theme}
                  onChange={(e) =>
                    previewAppearance({
                      ...preview,
                      theme: e.target.value as Preferences["theme"],
                    })
                  }
                >
                  {themes.map((t) => (
                    <option key={t} value={t}>
                      {t[0].toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field data-invalid={!colorValid}>
                <FieldLabel htmlFor="primary-color">Primary color</FieldLabel>
                <div className="primary-color-controls">
                  <Input
                    id="primary-color"
                    type="color"
                    value={
                      preview.primary_color ??
                      themeColors[preview.theme].primary
                    }
                    onChange={(e) => chooseColor(e.target.value)}
                    aria-describedby="primary-color-help"
                  />
                  <label className="sr-only" htmlFor="primary-color-hex">
                    Primary color hex
                  </label>
                  <Input
                    id="primary-color-hex"
                    type="text"
                    value={colorDraft}
                    onChange={(e) => chooseColor(e.target.value)}
                    maxLength={7}
                    pattern="#[0-9a-fA-F]{6}"
                    spellCheck={false}
                    autoComplete="off"
                    aria-invalid={!colorValid}
                    aria-describedby={
                      !colorValid ? "primary-color-error" : "primary-color-help"
                    }
                  />
                </div>
                <div
                  className="primary-color-presets"
                  aria-label="Primary color choices"
                >
                  {[
                    { name: "blue", color: "#4f8ec9" },
                    { name: "green", color: "#26845b" },
                    { name: "purple", color: "#8053b6" },
                    { name: "pink", color: "#b51565" },
                    { name: "amber", color: "#c78616" },
                  ].map(({ name, color }) => (
                    <button
                      key={name}
                      type="button"
                      className="primary-color-swatch"
                      aria-label={`Use ${name} primary color`}
                      aria-pressed={preview.primary_color === color}
                      onClick={() => chooseColor(color)}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      previewAppearance({ ...preview, primary_color: null })
                    }
                  >
                    Use theme default
                  </Button>
                </div>
                <p id="primary-color-help" className="muted text-xs">
                  Preview a color for buttons and progress. Text and focus
                  colors adjust for readability.
                </p>
                {!colorValid && (
                  <p
                    id="primary-color-error"
                    role="alert"
                    className="text-destructive text-xs"
                  >
                    Use a six-digit hex color, such as #4f8ec9.
                  </p>
                )}
              </Field>
              <Field>
                <FieldLabel htmlFor="experience">Experience</FieldLabel>
                <select
                  id="experience"
                  className="native-select"
                  value={preview.presentation}
                  onChange={(e) =>
                    onPreview({
                      ...preview,
                      presentation: e.target
                        .value as Preferences["presentation"],
                    })
                  }
                >
                  {presentations.map((p) => (
                    <option key={p} value={p}>
                      {p === "calm"
                        ? "Calm · a quiet everyday"
                        : p === "developer"
                          ? "Developer · activity graph & dense cards"
                          : "Playful · little steps & bigger controls"}
                    </option>
                  ))}
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor="layout">Layout</FieldLabel>
                <select
                  id="layout"
                  className="native-select"
                  value={preview.layout}
                  onChange={(e) =>
                    onPreview({
                      ...preview,
                      layout: e.target.value as Preferences["layout"],
                    })
                  }
                >
                  <option value="standard">Standard · room to breathe</option>
                  <option value="compact">Compact · everything in a row</option>
                </select>
              </Field>
              <fieldset className="widget-settings">
                <legend>Dashboard widgets</legend>
                <p className="muted text-xs mb-3">
                  The first visible widget sits above your trackers. Use the
                  arrows to change the order.
                </p>
                {preview.widget_order.map((kind, index) => {
                  const field =
                    kind === "summary"
                      ? "show_summary"
                      : kind === "activity"
                        ? "show_activity"
                        : "show_recent";
                  return (
                    <div className="widget-setting" key={kind}>
                      <label className="weekday">
                        <input
                          type="checkbox"
                          aria-label={
                            kind === "summary"
                              ? "Show daily summary"
                              : kind === "activity"
                                ? "Show activity widget"
                                : "Show recent activity"
                          }
                          checked={preview[field]}
                          onChange={(e) =>
                            onPreview({ ...preview, [field]: e.target.checked })
                          }
                        />
                        {widgetLabels[kind]}
                      </label>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={index === 0}
                          aria-label={`Move ${widgetLabels[kind]} up`}
                          onClick={() =>
                            onPreview({
                              ...preview,
                              widget_order: moveWidget(
                                preview.widget_order,
                                kind as WidgetKind,
                                -1,
                              ),
                            })
                          }
                        >
                          <ArrowUp />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={index === 2}
                          aria-label={`Move ${widgetLabels[kind]} down`}
                          onClick={() =>
                            onPreview({
                              ...preview,
                              widget_order: moveWidget(
                                preview.widget_order,
                                kind as WidgetKind,
                                1,
                              ),
                            })
                          }
                        >
                          <ArrowDown />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </fieldset>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button disabled={pending || !colorValid} type="submit">
                {pending ? "Saving…" : "Save appearance"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  onPreview(saved);
                  onClose();
                }}
              >
                Cancel preview
              </Button>
            </FieldGroup>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}
