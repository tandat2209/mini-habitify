import type { TemplateField } from "./validation";
export const fieldTypeLabels: Record<TemplateField["type"], string> = {
  text: "Text",
  textarea: "Long text",
  rating: "Rating",
  number: "Number",
  date: "Date",
  select: "Single choice",
  multi_select: "Multiple choice",
  list: "List of text",
};
export function createDraftField(id: string): TemplateField {
  return {
    key: `field_${id.replaceAll("-", "")}`,
    label: "",
    type: "text",
    required: false,
  };
}
export function changeFieldType(
  field: TemplateField,
  type: TemplateField["type"],
): TemplateField {
  const { options, config, ...rest } = field;
  return {
    ...rest,
    type,
    ...(type === "rating" ? { config: config ?? { min: 1, max: 5 } } : {}),
    ...(type === "select" || type === "multi_select"
      ? { options: options ? [...options] : ["", ""] }
      : {}),
  };
}
export function moveField(
  fields: TemplateField[],
  key: string,
  direction: number,
): TemplateField[] {
  const from = fields.findIndex((field) => field.key === key);
  const to = from + direction;
  const next = [...fields];
  if (from < 0 || to < 0 || to >= fields.length) return next;
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}
