import { test, expect } from "@playwright/test";
import { selectOption } from "./select-option";

test("themed dropdowns support keyboard selection, dismissal, and mobile menus", async ({
  page,
}) => {
  await page.goto("/signup");
  await page
    .getByLabel("Email address")
    .fill(`selects-${crypto.randomUUID()}@example.com`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("playwright-test-password");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.getByRole("button", { name: "New tracker", exact: true }).click();
  await expect(page.locator('select:not([aria-hidden="true"])')).toHaveCount(0);
  const type = page.getByRole("combobox", {
    name: "Tracker type",
    exact: true,
  });
  await type.focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("listbox")).toBeVisible();
  await expect(
    page.getByRole("option", { name: "Habit · yes or no", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("End");
  await expect(
    page.getByRole("option", { name: "Numeric · a measurement", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(type).toContainText("Numeric");
  await expect(type).toBeFocused();
  await type.click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(type).toBeFocused();
  await page.getByLabel("Name", { exact: true }).fill("Dropdown tracker");
  await selectOption(page.getByLabel("Goal period", { exact: true }), "weekly");
  await selectOption(page.getByLabel("Icon", { exact: true }), "book");
  await selectOption(page.getByLabel("Accent", { exact: true }), "lavender");
  await page
    .getByRole("button", { name: "Create tracker", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await page
    .getByRole("button", { name: "View Dropdown tracker history", exact: true })
    .click();
  await page.getByRole("button", { name: "Edit tracker", exact: true }).click();
  await expect(type).toBeDisabled();
  await expect(type).toContainText("Numeric");
  await expect(page.getByLabel("Goal period", { exact: true })).toContainText(
    "Weekly",
  );
  await expect(page.getByLabel("Icon", { exact: true })).toContainText("Book");
  await expect(page.getByLabel("Accent", { exact: true })).toContainText(
    "Lavender",
  );
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Appearance", exact: true }).click();
  const theme = page.getByRole("combobox", { name: "Theme", exact: true });
  await theme.click();
  await page.getByRole("option", { name: "Neumorphism", exact: true }).click();
  await theme.click();
  await expect(page.getByRole("listbox")).toHaveAttribute(
    "data-theme",
    "neumorphism",
  );
  await page.screenshot({
    path: test.info().outputPath("themed-dropdown-desktop.png"),
    animations: "disabled",
  });
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });
  await theme.click();
  await expect(page.getByRole("listbox")).toBeInViewport();
  await page.screenshot({
    path: test.info().outputPath("themed-dropdown-mobile.png"),
    animations: "disabled",
  });
  await page.getByRole("option", { name: "Terminal", exact: true }).click();
  await expect(theme).toContainText("Terminal");
  await page
    .getByRole("button", { name: "Cancel preview", exact: true })
    .click();
});
