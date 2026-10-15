import { describe, expect, it } from "vitest";
import {
  templateSchema,
  validateDetails,
  detailsForDisplay,
} from "./validation";
const definition = {
  name: "Session notes",
  description: "",
  fields: [
    { key: "summary", label: "Summary", type: "text", required: true },
    { key: "rating", label: "Rating", type: "number" },
    { key: "date", label: "Reference date", type: "date" },
    {
      key: "mode",
      label: "Mode",
      type: "select",
      options: ["Solo", "Together"],
    },
    {
      key: "tags",
      label: "Tags",
      type: "multi_select",
      options: ["New", "Review"],
    },
    { key: "items", label: "Items", type: "list" },
  ],
};
describe("template definitions", () => {
  it("accepts the six generic types and defaults fields to optional", () => {
    const parsed = templateSchema.parse(definition);
    expect(parsed.fields[1].required).toBe(false);
  });
  it("rejects duplicate/reserved keys, unknown schema properties and unsupported types", () => {
    for (const fields of [
      [definition.fields[0], definition.fields[0]],
      [{ key: "__proto__", label: "Bad", type: "text" }],
      [{ key: "notes", label: "Notes", type: "object_list" }],
      [{ key: "notes", label: "Notes", type: "text", surprise: true }],
      [{ key: "mode", label: "Mode", type: "select" }],
    ])
      expect(templateSchema.safeParse({ ...definition, fields }).success).toBe(
        false,
      );
  });
});
describe("structured details", () => {
  it("allows legacy entries and progress-only records", () => {
    expect(validateDetails([], {}).success).toBe(true);
    expect(
      validateDetails(templateSchema.parse(definition).fields, {}).success,
    ).toBe(true);
    expect(validateDetails([], { summary: "No template" }).success).toBe(false);
  });
  it("accepts real types including zero and arrays", () => {
    expect(
      validateDetails(templateSchema.parse(definition).fields, {
        summary: "Practiced",
        rating: 0,
        date: "2026-10-14",
        mode: "Solo",
        tags: ["New", "Review"],
        items: ["One", "Two"],
      }).success,
    ).toBe(true);
  });
  it("allows optional fields to be omitted but requires a summary for submitted content", () => {
    const fields = templateSchema.parse(definition).fields;
    expect(validateDetails(fields, { summary: "Done" }).success).toBe(true);
    expect(validateDetails(fields, { rating: 2 }).success).toBe(false);
    expect(validateDetails(fields, { summary: " " }).success).toBe(false);
  });
  it("rejects invalid types, selections, dates, unknown keys and nested objects", () => {
    const fields = templateSchema.parse(definition).fields;
    for (const invalid of [
      { rating: "2" },
      { rating: Infinity },
      { date: "2026-02-30" },
      { mode: "Other" },
      { tags: ["Other"] },
      { tags: ["New", "New"] },
      { items: [2] },
      { extra: "No" },
      { rating: null },
      { items: { value: "One" } },
    ])
      expect(
        validateDetails(fields, { summary: "Done", ...invalid }).success,
      ).toBe(false);
  });
  it("renders labels and values from the recorded version", () => {
    const fields = templateSchema.parse(definition).fields;
    expect(
      detailsForDisplay(fields, { summary: "Original", items: ["One", "Two"] }),
    ).toEqual([
      { key: "summary", label: "Summary", value: "Original" },
      { key: "items", label: "Items", value: "One · Two" },
    ]);
    const next = templateSchema.parse({
      ...definition,
      fields: [{ key: "new", label: "New label", type: "text" }],
    });
    expect(validateDetails(next.fields, { summary: "Original" }).success).toBe(
      false,
    );
    expect(validateDetails(fields, { summary: "Edited" }).success).toBe(true);
    expect(detailsForDisplay(fields, {})).toEqual([]);
  });
});

it("preserves selection option values exactly across schema reads", () => {
  const template = templateSchema.parse({
    name: "Options",
    fields: [
      { key: "mode", label: "Mode", type: "select", options: [" Solo "] },
    ],
  });
  expect(template.fields[0].options).toEqual([" Solo "]);
  expect(validateDetails(template.fields, { mode: " Solo " }).success).toBe(
    true,
  );
});
