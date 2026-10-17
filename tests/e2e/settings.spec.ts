import { test, expect } from "@playwright/test";

test("settings groups configuration on desktop and mobile", async ({
  page,
}) => {
  await page.goto("/signup");
  await page
    .getByLabel("Email address")
    .fill(`settings-${crypto.randomUUID()}@example.com`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("playwright-test-password");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  const settings = page.getByRole("button", { name: "Settings", exact: true });
  await expect(settings).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Appearance", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Templates", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Connected apps" })).toHaveCount(
    0,
  );
  await settings.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog", { name: "Settings", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/settings-desktop.png",
    animations: "disabled",
  });
  await page.keyboard.press("Escape");
  await expect(settings).toBeFocused();

  await page.setViewportSize({ width: 390, height: 844 });
  await settings.click();
  await expect(
    page.getByRole("link", { name: "Agent connections" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/settings-mobile.png",
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Templates", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await settings.click();
  await page.getByRole("button", { name: "Appearance", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Make it feel like you." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await settings.click();
  await page.getByRole("link", { name: "Agent connections" }).click();
  await expect(page).toHaveURL(/\/settings\/connections/);
  await expect(
    page.getByRole("heading", { name: "Connected apps", exact: true }),
  ).toBeVisible();
});
