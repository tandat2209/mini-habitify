"use client";
import { createContext, type CSSProperties, type ReactNode } from "react";
import { getAccentTokens } from "@/features/themes/colors";
import type { Preferences } from "@/features/trackers/validation";
export const AppearanceColorContext = createContext<
  Record<`--${string}`, string>
>({});
export function AppearanceScope({
  theme,
  primaryColor,
  layout,
  presentation,
  children,
}: {
  theme: Preferences["theme"];
  primaryColor: string | null;
  layout?: Preferences["layout"];
  presentation: Preferences["presentation"];
  children: ReactNode;
}) {
  const colors = getAccentTokens(theme, primaryColor);
  return (
    <AppearanceColorContext.Provider value={colors}>
      <div
        className="app"
        data-theme={theme}
        data-layout={layout}
        data-presentation={presentation}
        data-custom-primary={colors["--primary"] ? true : undefined}
        style={colors as CSSProperties}
      >
        {children}
      </div>
    </AppearanceColorContext.Provider>
  );
}
