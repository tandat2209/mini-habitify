import type { Preferences } from "../trackers/validation";
export const themeColors: Record<
  Preferences["theme"],
  { primary: string; background: string; card: string; muted: string }
> = {
  paper: {
    primary: "#35573c",
    background: "#f7f5ef",
    card: "#fffef9",
    muted: "#efede4",
  },
  pastel: {
    primary: "#785497",
    background: "#f5f1fc",
    card: "#fffcff",
    muted: "#eee5f6",
  },
  terminal: {
    primary: "#a3e98b",
    background: "#101711",
    card: "#162219",
    muted: "#213125",
  },
  brutalist: {
    primary: "#161611",
    background: "#fff6db",
    card: "#fffef7",
    muted: "#f0e7cf",
  },
  neumorphism: {
    primary: "#b51565",
    background: "#edf0f3",
    card: "#edf0f3",
    muted: "#e1e5eb",
  },
};
type Theme = Preferences["theme"];
function channels(hex: string): number[] {
  return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
}
function luminance(hex: string) {
  const linear = channels(hex).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}
export function contrastRatio(first: string, second: string) {
  const values = [luminance(first), luminance(second)].sort((a, b) => a - b);
  return (values[1] + 0.05) / (values[0] + 0.05);
}
function mix(first: string, second: string, amount: number): string {
  const target = channels(second);
  return (
    "#" +
    channels(first)
      .map((value, index) =>
        Math.round(value + (target[index] - value) * amount)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
export function getAccentTokens(
  theme: Theme,
  color: string | null,
): Record<`--${string}`, string> {
  if (!color || !/^#[0-9a-f]{6}$/i.test(color)) return {};
  const primary = color.toLowerCase();
  const palette = themeColors[theme];
  const surfaces = [palette.background, palette.card, palette.muted];
  const minimumContrast = (candidate: string) =>
    Math.min(...surfaces.map((surface) => contrastRatio(candidate, surface)));
  const target =
    minimumContrast("#000000") >= minimumContrast("#ffffff")
      ? "#000000"
      : "#ffffff";
  let ink = primary;
  for (let step = 1; minimumContrast(ink) < 4.5 && step <= 100; step++)
    ink = mix(primary, target, step / 100);
  return {
    "--primary": primary,
    "--primary-highlight": primary,
    "--primary-foreground":
      contrastRatio(primary, "#000000") >= contrastRatio(primary, "#ffffff")
        ? "#000000"
        : "#ffffff",
    "--primary-ink": ink,
    "--progress-color": ink,
    "--chart-0": mix(palette.background, ink, 0.08),
    "--chart-1": mix(palette.background, ink, 0.25),
    "--chart-2": mix(palette.background, ink, 0.5),
    "--chart-3": mix(palette.background, ink, 0.75),
    "--chart-4": ink,
  };
}
