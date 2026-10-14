import { test, expect } from "@playwright/test";
test("account → habit → check-in → refresh → appearance → log out", async ({
  page,
}) => {
  const email = `e2e-${crypto.randomUUID()}@example.com`;
  await page.goto("/");
  await page.getByRole("link", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/signup/);
  await expect(
    page.getByRole("heading", { name: "Find your everyday." }),
  ).toBeVisible();
  await page.getByLabel("Email address").fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("playwright-test-password");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A little progress, every day." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "New tracker", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Read a chapter");
  await page
    .getByRole("button", { name: "Create tracker", exact: true })
    .click();
  const card = page.getByRole("article").filter({
    has: page.getByRole("heading", { name: "Read a chapter", exact: true }),
  });
  await card.getByRole("button", { name: "Check in" }).click();
  await expect(
    card.getByRole("button", { name: "Undo check-in" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    card.getByRole("button", { name: "Undo check-in" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Appearance", exact: true }).click();
  await page.getByLabel("Theme", { exact: true }).selectOption("terminal");
  await page
    .getByLabel("Experience", { exact: true })
    .selectOption("developer");
  await page.getByRole("button", { name: "Save appearance" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(page.locator('[data-theme="terminal"]')).toBeVisible();
  await expect(
    card.getByRole("button", { name: "Undo check-in" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
  await page.goto("/today");
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Email address").fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("playwright-test-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator('[data-theme="terminal"]')).toBeVisible();
  await expect(
    card.getByRole("button", { name: "Undo check-in" }),
  ).toBeVisible();
});
test("authentication screen works on mobile and labels forms", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await expect(page.getByLabel("Email address")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("all tracker types, log editing, playful style, compact layout, and archive", async ({
  page,
}) => {
  await page.goto("/signup");
  await page
    .getByLabel("Email address")
    .fill(`types-${crypto.randomUUID()}@example.com`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("playwright-test-password");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A little progress, every day." }),
  ).toBeVisible();
  for (const [type, name, value] of [
    ["counter", "Water", "2"],
    ["duration", "Focus", "15"],
    ["numeric", "Mood", "4"],
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
    await card.getByRole("spinbutton").fill(value);
    await card.getByRole("button", { name: "Add", exact: true }).click();
    await expect(card.locator(".tracker-value")).toContainText(value);
  }
  await page.getByRole("button", { name: "View Water history" }).click();
  await page.getByRole("button", { name: /Edit entry on/ }).click();
  await page.getByLabel("Value", { exact: true }).fill("3");
  await page.getByRole("button", { name: "Save entry", exact: true }).click();
  await expect(page.locator(".history-row")).toContainText("3");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Appearance", exact: true }).click();
  await page.getByLabel("Theme", { exact: true }).selectOption("pastel");
  await page.getByLabel("Experience", { exact: true }).selectOption("playful");
  await page.getByLabel("Layout", { exact: true }).selectOption("compact");
  await page.getByRole("button", { name: "Save appearance" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(
    page.locator('[data-presentation="playful"][data-layout="compact"]'),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Your little steps" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "View Water history" }).click();
  await page
    .getByRole("button", { name: "Archive tracker", exact: true })
    .click();
  await expect(
    page.getByRole("article").filter({
      has: page.getByRole("heading", { name: "Water", exact: true }),
    }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Archive", exact: true }).click();
  await page.getByRole("button", { name: "View history", exact: true }).click();
  await expect(page.locator(".history-row")).toContainText("3");
});
