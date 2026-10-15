import { describe, expect, it } from "vitest";
import { getAccentTokens, contrastRatio, themeColors } from "./colors";
import { preferencesSchema, themes } from "../trackers/validation";
import { applyExperiencePreset } from "./presets";
const preferences = {
  theme: "paper",
  layout: "standard",
  presentation: "calm",
  show_activity: true,
};
describe("primary color preferences", () => {
  it("keeps existing preferences on theme defaults and normalizes valid hex colors", () => {
    expect(preferencesSchema.parse(preferences).primary_color).toBeNull();
    expect(
      preferencesSchema.parse({ ...preferences, primary_color: "#4F8EC9" })
        .primary_color,
    ).toBe("#4f8ec9");
  });
  it("rejects invalid colors and non-color CSS values", () => {
    for (const primary_color of [
      "blue",
      "#fff",
      "#12345678",
      "#zzzzzz",
      "red;display:none",
      "var(--primary)",
      42,
    ])
      expect(
        preferencesSchema.safeParse({ ...preferences, primary_color }).success,
      ).toBe(false);
  });
  it("presets restore their theme defaults", () => {
    const current = preferencesSchema.parse({
      ...preferences,
      primary_color: "#4f8ec9",
    });
    for (const preset of ["calm", "developer", "playful"] as const)
      expect(applyExperiencePreset(preset, current).primary_color).toBeNull();
  });
});
describe("accessible custom accent tokens", () => {
  it("leaves original theme tokens intact with no override", () => {
    expect(getAccentTokens("neumorphism", null)).toEqual({});
    expect(getAccentTokens("paper", "invalid")).toEqual({});
  });
  it("preserves the chosen fill and supplies readable text, focus, and chart colors", () => {
    for (const theme of themes)
      for (const color of [
        "#4f8ec9",
        "#ffffff",
        "#000000",
        "#ffff00",
        "#777777",
        "#b51565",
      ]) {
        const tokens = getAccentTokens(theme, color);
        expect(tokens["--primary"]).toBe(color);
        expect(
          contrastRatio(color, tokens["--primary-foreground"]),
        ).toBeGreaterThanOrEqual(4.5);
        for (const surface of [
          themeColors[theme].background,
          themeColors[theme].card,
          themeColors[theme].muted,
        ])
          expect(
            contrastRatio(tokens["--primary-ink"], surface),
          ).toBeGreaterThanOrEqual(4.5);
        expect(tokens["--chart-4"]).toBe(tokens["--primary-ink"]);
        expect(tokens["--chart-1"]).not.toBe(tokens["--chart-4"]);
      }
  });
});
