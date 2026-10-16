import { z } from "zod";
import { trackingDateSchema } from "../trackers/validation";
export const fieldSchema = z
  .strictObject({
    key: z
      .string()
      .regex(/^[a-z][a-z0-9_]{0,63}$/)
      .refine(
        (key) => !["constructor", "prototype", "__proto__"].includes(key),
        "Choose another field key.",
      ),
    label: z.string().trim().min(1, "Give this field a label.").max(80),
    type: z.enum([
      "text",
      "textarea",
      "rating",
      "number",
      "date",
      "select",
      "multi_select",
      "list",
    ]),
    required: z.boolean().default(false),
    options: z
      .array(
        z
          .string()
          .refine(
            (value) => value.trim().length >= 1 && value.trim().length <= 120,
            "Options need 1 to 120 non-padding characters.",
          ),
      )
      .min(1, "Add at least one option.")
      .max(50)
      .refine(
        (options) => new Set(options).size === options.length,
        "Give each option a different value.",
      )
      .optional(),
    config: z
      .strictObject({
        min: z.number().int().min(-1e12).max(1e12),
        max: z.number().int().min(-1e12).max(1e12),
      })
      .refine(
        (range) => range.min < range.max,
        "Rating minimum must be below maximum.",
      )
      .optional(),
    semanticType: z.string().trim().min(1).max(80).optional(),
  })
  .superRefine((field, ctx) => {
    if ((field.type === "rating") !== (field.config !== undefined))
      ctx.addIssue({
        code: "custom",
        path: ["config"],
        message: "Only rating fields require min/max config.",
      });
    const selection = field.type === "select" || field.type === "multi_select";
    if (selection !== (field.options !== undefined))
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: selection
          ? "Selection fields need options."
          : "Only selection fields accept options.",
      });
  });
export const fieldsSchema = z
  .array(fieldSchema)
  .min(1, "Add at least one field.")
  .max(30)
  .refine(
    (fields) => new Set(fields.map((f) => f.key)).size === fields.length,
    "Field keys must be unique.",
  );
export const templateSchema = z.strictObject({
  name: z.string().trim().min(1, "Give your template a name.").max(80),
  description: z.string().trim().max(500).default(""),
  fields: fieldsSchema,
});
export type TemplateDefinition = z.infer<typeof templateSchema>;
export type TemplateField = z.infer<typeof fieldSchema>;
export type Details = Record<string, string | number | string[]>;
export function validateDetails(fields: TemplateField[], details: unknown) {
  const shape: Record<string, z.ZodType> = {};
  for (const field of fields) {
    let schema: z.ZodType;
    switch (field.type) {
      case "text":
      case "textarea":
        schema = z
          .string()
          .max(5000)
          .refine((v) => v.trim().length > 0, "Enter some text.");
        break;
      case "rating":
        schema = z.number().int().min(field.config!.min).max(field.config!.max);
        break;
      case "number":
        schema = z.number().finite().min(-1e12).max(1e12);
        break;
      case "date":
        schema = trackingDateSchema;
        break;
      case "select":
        schema = z
          .string()
          .refine((v) => field.options!.includes(v), "Choose a listed option.");
        break;
      case "multi_select":
        schema = z
          .array(z.string())
          .min(1)
          .max(50)
          .refine(
            (values) =>
              new Set(values).size === values.length &&
              values.every((v) => field.options!.includes(v)),
            "Choose distinct listed options.",
          );
        break;
      case "list":
        schema = z
          .array(
            z
              .string()
              .max(500)
              .refine(
                (v) => v.trim().length > 0,
                "List items cannot be blank.",
              ),
          )
          .min(1)
          .max(100);
        break;
    }
    shape[field.key] = field.required ? schema : schema.optional();
  }
  // Skipping the journal is always valid, even when its submitted form has required fields.
  const empty = z.strictObject({}).safeParse(details);
  if (empty.success) return { success: true as const, data: {} as Details };
  const parsed = z.strictObject(shape).safeParse(details);
  return parsed.success
    ? { success: true as const, data: parsed.data as Details }
    : parsed;
}
export function detailsForDisplay(fields: TemplateField[], details: Details) {
  return fields.flatMap((field) => {
    const value = details[field.key];
    return value === undefined
      ? []
      : [
          {
            key: field.key,
            label: field.label,
            value: Array.isArray(value) ? value.join(" · ") : String(value),
          },
        ];
  });
}

export function mergeTemplateFields(
  current: TemplateField[],
  upserts: TemplateField[],
  removeKeys: string[],
) {
  const updates = new Map(upserts.map((field) => [field.key, field]));
  return fieldsSchema.parse([
    ...current
      .filter((field) => !removeKeys.includes(field.key))
      .map((field) => updates.get(field.key) ?? field),
    ...upserts.filter(
      (field) => !current.some((existing) => existing.key === field.key),
    ),
  ]);
}
export const templatePatchSchema = z
  .strictObject({
    name: templateSchema.shape.name.optional(),
    description: z.string().trim().max(500).optional(),
    upsert_fields: z
      .array(fieldSchema)
      .min(1)
      .max(30)
      .refine(
        (fields) => new Set(fields.map((f) => f.key)).size === fields.length,
        "Field keys must be unique.",
      )
      .optional(),
    remove_field_keys: z.array(fieldSchema.shape.key).min(1).max(30).optional(),
  })
  .refine(
    (patch) => Object.keys(patch).length > 0,
    "Provide at least one change.",
  )
  .refine(
    (patch) =>
      !(patch.upsert_fields ?? []).some((f) =>
        patch.remove_field_keys?.includes(f.key),
      ),
    "Cannot update and remove the same field.",
  );
