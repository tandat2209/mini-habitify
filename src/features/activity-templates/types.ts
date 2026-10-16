import type { TemplateField, Details } from "./validation";
import type { Tracker, Log } from "../tracker-engine/engine";
export interface ActivityTemplate {
  id: string;
  name: string;
  description: string;
  current_version_id: string | null;
  archived_at?: string | null;
}
export interface TemplateVersion {
  id: string;
  template_id: string;
  version: number;
  fields: TemplateField[];
}
export interface TemplateData {
  templates: ActivityTemplate[];
  templateVersions: TemplateVersion[];
}
export interface ActivityTracker extends Tracker {
  activity_template_id: string | null;
}
export interface ActivityLog extends Log {
  details: Details;
  template_version_id: string | null;
}
export function currentTemplateVersion(
  tracker: ActivityTracker,
  data: TemplateData,
) {
  const template = data.templates.find(
    (t) => t.id === tracker.activity_template_id,
  );
  return data.templateVersions.find(
    (v) => v.id === template?.current_version_id,
  );
}
