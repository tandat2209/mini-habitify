import type { Preferences } from "../trackers/validation";
export type WidgetKind = "summary" | "activity" | "recent";
export const widgetLabels: Record<WidgetKind, string> = {
  summary: "Daily summary",
  activity: "Activity",
  recent: "Recent activity",
};
export function applyExperiencePreset(
  name: Preferences["presentation"],
  current: Preferences,
): Preferences {
  const common = {
    ...current,
    presentation: name,
    primary_color: null,
    show_activity: true,
    show_summary: true,
    show_recent: true,
  };
  if (name === "developer")
    return {
      ...common,
      theme: "terminal",
      layout: "compact",
      widget_order: ["activity", "summary", "recent"],
    };
  if (name === "playful")
    return {
      ...common,
      theme: "pastel",
      layout: "standard",
      show_recent: false,
      widget_order: ["activity", "summary", "recent"],
    };
  return {
    ...common,
    theme: "paper",
    layout: "standard",
    widget_order: ["summary", "activity", "recent"],
  };
}
export function moveWidget(
  order: WidgetKind[],
  kind: WidgetKind,
  direction: number,
): WidgetKind[] {
  const from = order.indexOf(kind);
  const to = from + direction;
  const next = [...order];
  if (from < 0 || to < 0 || to >= next.length) return next;
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}
