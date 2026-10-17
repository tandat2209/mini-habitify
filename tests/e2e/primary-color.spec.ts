import { selectOption } from "./select-option";
import { test, expect } from "@playwright/test";
test("custom primary colors preview, persist in pages and dialogs, and reset to theme defaults", async ({
  page,
}) => {
  await page.goto("/signup");
  await page
    .getByLabel("Email address")
    .fill(`color-${crypto.randomUUID()}@example.com`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("playwright-test-password");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.getByRole("button", { name: "New tracker", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Everyday practice");
  await page
    .getByRole("button", { name: "Create tracker", exact: true })
    .click();
  await page.getByRole("button", { name: "Check in", exact: true }).click();
  const app = page.locator(".app");
  const primary = () =>
    app.evaluate((element) =>
      getComputedStyle(element).getPropertyValue("--primary").trim(),
    );
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Appearance", exact: true }).click();
  await selectOption(page.getByLabel("Theme", { exact: true }), "neumorphism");
  await page.getByLabel("Primary color hex", { exact: true }).fill("#4f8ec9");
  expect(await primary()).toBe("#4f8ec9");
  await page
    .getByRole("button", { name: "Cancel preview", exact: true })
    .click();
  expect(await primary()).toBe("#35573c");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Appearance", exact: true }).click();
  await selectOption(page.getByLabel("Theme", { exact: true }), "neumorphism");
  await page.getByLabel("Primary color", { exact: true }).fill("#4f8ec9");
  await page.getByLabel("Primary color hex", { exact: true }).fill("#oops");
  await expect(
    page.getByLabel("Primary color hex", { exact: true }),
  ).toHaveAttribute("aria-invalid", "true");
  await expect(
    page.getByRole("button", { name: "Save appearance", exact: true }),
  ).toBeDisabled();
  expect(await primary()).toBe("#4f8ec9");
  await page.getByLabel("Primary color hex", { exact: true }).fill("#4F8EC9");
  await page
    .getByRole("button", { name: "Save appearance", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(app).toHaveAttribute("data-theme", "neumorphism");
  expect(await primary()).toBe("#4f8ec9");
  await expect(
    page.getByRole("button", { name: "Undo check-in" }),
  ).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath("custom-blue-desktop.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "View Everyday practice history" })
    .click();
  expect(
    await page
      .getByRole("dialog")
      .evaluate((element) =>
        getComputedStyle(element).getPropertyValue("--primary").trim(),
      ),
  ).toBe("#4f8ec9");
  await page.getByRole("link", { name: "Open full history" }).click();
  await expect(page).toHaveURL(/\/today\/trackers\//);
  await expect(
    page.getByRole("heading", { name: "Everyday practice", level: 1 }),
  ).toBeVisible();
  expect(await primary()).toBe("#4f8ec9");
  await page.getByRole("link", { name: "Back to Today" }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Appearance", exact: true }).click();
  await page
    .getByRole("button", { name: "Use theme default", exact: true })
    .click();
  await expect(
    page.getByLabel("Primary color hex", { exact: true }),
  ).toHaveValue("#b51565");
  await page
    .getByRole("button", { name: "Save appearance", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(app).toHaveAttribute("data-theme", "neumorphism");
  expect(await primary()).toBe("#b51565");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Appearance", exact: true }).click();
  await page
    .getByRole("button", { name: "Use blue primary color", exact: true })
    .click();
  await expect(
    page.getByLabel("Primary color hex", { exact: true }),
  ).toHaveValue("#4f8ec9");
  await page.getByRole("dialog").evaluate((element) => {
    element.scrollTop = 0;
  });
  await page.screenshot({
    path: test.info().outputPath("custom-color-mobile.png"),
    fullPage: true,
    animations: "disabled",
  });
  expect(
    await page
      .getByRole("dialog")
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Cancel preview", exact: true })
    .click();
});
