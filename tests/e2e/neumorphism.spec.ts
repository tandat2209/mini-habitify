import { test, expect } from "@playwright/test";
test("Neumorphism previews, persists, and keeps check-ins across desktop and mobile", async ({
  page,
}) => {
  await page.goto("/signup");
  await page
    .getByLabel("Email address")
    .fill(`soft-ui-${crypto.randomUUID()}@example.com`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("playwright-test-password");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A little progress, every day." }),
  ).toBeVisible();
  for (const [name, type, value] of [
    ["Daily pause", "habit", ""],
    ["Creative time", "duration", "12"],
    ["Little steps", "counter", "3"],
  ]) {
    await page
      .getByRole("button", { name: "New tracker", exact: true })
      .click();
    await page.getByLabel("Name", { exact: true }).fill(name);
    await page.getByLabel("Tracker type").selectOption(type);
    await page
      .getByRole("button", { name: "Create tracker", exact: true })
      .click();
    const card = page
      .getByRole("article")
      .filter({ has: page.getByRole("heading", { name, exact: true }) });
    await card.getByRole("button", { name: "Check in", exact: true }).click();
    if (type !== "habit") {
      await card.getByRole("spinbutton").fill(value);
      await card.getByRole("button", { name: "Add", exact: true }).click();
      await expect(card.locator(".tracker-value")).toContainText(value);
    } else
      await expect(
        card.getByRole("button", { name: "Undo check-in" }),
      ).toBeVisible();
  }
  const habit = page.getByRole("article").filter({
    has: page.getByRole("heading", { name: "Daily pause", exact: true }),
  });
  const before = await page.locator(".tracker-value").allTextContents();
  await page.getByRole("button", { name: "Appearance", exact: true }).click();
  await page.getByLabel("Theme", { exact: true }).selectOption("neumorphism");
  await expect(page.locator(".app")).toHaveAttribute(
    "data-theme",
    "neumorphism",
  );
  await page
    .getByRole("button", { name: "Cancel preview", exact: true })
    .click();
  await expect(page.locator(".app")).toHaveAttribute("data-theme", "paper");
  await page.reload();
  await expect(page.locator(".app")).toHaveAttribute("data-theme", "paper");
  await page.getByRole("button", { name: "Appearance", exact: true }).click();
  await page.getByLabel("Theme", { exact: true }).selectOption("neumorphism");
  await page
    .getByRole("button", { name: "Save appearance", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".app")).toHaveAttribute(
    "data-theme",
    "neumorphism",
  );
  await expect(
    habit.getByRole("button", { name: "Undo check-in" }),
  ).toBeVisible();
  expect(await page.locator(".tracker-value").allTextContents()).toEqual(
    before,
  );
  await page.screenshot({
    path: test.info().outputPath("neumorphism-desktop.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "New tracker", exact: true }).click();
  const name = page.getByLabel("Name", { exact: true });
  await name.focus();
  expect(
    await name.evaluate((input) => getComputedStyle(input).boxShadow),
  ).toContain("inset");
  expect(
    await name.evaluate((input) => getComputedStyle(input).outlineStyle),
  ).toBe("solid");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Description", { exact: true })).toBeFocused();
  await page.screenshot({
    path: test.info().outputPath("neumorphism-mobile-form.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .getByRole("button", { name: "View Daily pause history", exact: true })
    .click();
  await expect(page.locator(".history-row")).toContainText("Completed");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.screenshot({
    path: test.info().outputPath("neumorphism-mobile.png"),
    fullPage: true,
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await habit.evaluate((card) => getComputedStyle(card).transitionDuration),
  ).toBe("0s");
});
