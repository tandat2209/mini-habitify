import type { Locator } from "@playwright/test";

export async function selectOption(
  control: Locator,
  choice: string | { label: string },
) {
  await control.click();
  const options = control.page().getByRole("option");
  const option =
    typeof choice === "string"
      ? options.and(
          control.page().locator(`[data-value=${JSON.stringify(choice)}]`),
        )
      : control
          .page()
          .getByRole("option", { name: choice.label.trim(), exact: true });
  await option.click();
}
