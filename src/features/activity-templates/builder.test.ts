import { describe, expect, it } from "vitest";
import { createDraftField, changeFieldType, moveField } from "./builder";
import { fieldSchema, templateSchema } from "./validation";
describe("visual template drafts", () => {
  it("generates unique valid keys without relying on field labels", () => {
    const first = createDraftField("11111111-1111-4111-8111-111111111111");
    const second = createDraftField("22222222-2222-4222-8222-222222222222");
    expect(first.key).not.toBe(second.key);
    expect(fieldSchema.safeParse({ ...first, label: "A label" }).success).toBe(
      true,
    );
    expect({ ...first, label: "Renamed" }.key).toBe(first.key);
  });
  it("preserves field identity and metadata when types change", () => {
    const field = {
      ...createDraftField("one"),
      label: "Mode",
      semanticType: "session_mode",
    };
    const selection = changeFieldType(field, "select");
    expect(selection.options).toEqual(["", ""]);
    const withOptions = { ...selection, options: ["Solo", " Together "] };
    expect(changeFieldType(withOptions, "multi_select")).toMatchObject({
      key: field.key,
      options: ["Solo", " Together "],
      semanticType: "session_mode",
    });
    const numeric = changeFieldType(withOptions, "number");
    expect(numeric).not.toHaveProperty("options");
    expect(numeric.key).toBe(field.key);
    expect(field.type).toBe("text");
  });
  it("reorders fields without mutating their identities or original definitions", () => {
    const fields = ["one", "two", "three"].map((id) => ({
      ...createDraftField(id),
      label: id,
    }));
    expect(
      moveField(fields, fields[1].key, -1).map((field) => field.label),
    ).toEqual(["two", "one", "three"]);
    expect(moveField(fields, fields[0].key, -1)).toEqual(fields);
    expect(moveField(fields, "missing", 1)).toEqual(fields);
    expect(fields.map((field) => field.label)).toEqual(["one", "two", "three"]);
    expect(
      templateSchema.safeParse({
        name: "Generic",
        fields: moveField(fields, fields[1].key, 1),
      }).success,
    ).toBe(true);
  });
});

it("keeps rating bounds only while editing a rating field", () => {
  const text = { ...createDraftField("rating"), label: "Understanding" };
  const rating = changeFieldType(text, "rating");
  expect(rating.config).toEqual({ min: 1, max: 5 });
  expect(
    changeFieldType({ ...rating, config: { min: 0, max: 10 } }, "rating")
      .config,
  ).toEqual({ min: 0, max: 10 });
  expect(changeFieldType(rating, "textarea")).not.toHaveProperty("config");
});
