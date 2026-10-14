"use client";
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
      <DialogContent data-theme={preview.theme}>
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
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="theme">Theme</FieldLabel>
              <select
                id="theme"
                className="native-select"
                value={preview.theme}
                onChange={(e) =>
                  onPreview({
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
            <Field>
              <FieldLabel htmlFor="experience">Experience</FieldLabel>
              <select
                id="experience"
                className="native-select"
                value={preview.presentation}
                onChange={(e) =>
                  onPreview({
                    ...preview,
                    presentation: e.target.value as Preferences["presentation"],
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
            <Field>
              <label className="weekday">
                <input
                  type="checkbox"
                  checked={preview.show_activity}
                  onChange={(e) =>
                    onPreview({ ...preview, show_activity: e.target.checked })
                  }
                />
                Show activity widget
              </label>
            </Field>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button disabled={pending} type="submit">
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
        </form>
      </DialogContent>
    </Dialog>
  );
}
