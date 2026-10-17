import { selectOption } from "./select-option";
import { test, expect } from "@playwright/test";

test("PWA metadata, installation help, and privacy-safe offline navigation", async ({
  page,
  context,
  request,
}) => {
  await page.goto("/signup");
  const manifestLink = page.locator('link[rel="manifest"]');
  await expect(manifestLink).toHaveAttribute("href", "/manifest.webmanifest");
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest).toMatchObject({
    id: "/",
    name: "mini-habitify",
    start_url: "/today",
    scope: "/",
    display: "standalone",
  });
  for (const icon of manifest.icons) {
    const image = await request.get(icon.src);
    expect(image.ok()).toBe(true);
    expect(image.headers()["content-type"]).toContain("image/png");
    const data = await image.body();
    expect(`${data.readUInt32BE(16)}x${data.readUInt32BE(20)}`).toBe(
      icon.sizes,
    );
  }
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    "href",
    "/apple-touch-icon.png",
  );
  await expect(
    page.locator('meta[name="mobile-web-app-capable"]'),
  ).toHaveAttribute("content", "yes");
  await page.getByText("Install app", { exact: true }).click();
  await expect(page.getByText(/On iPhone or iPad/)).toBeVisible();
  await expect(
    page
      .locator(".pwa-install-guide p")
      .filter({ hasText: "On iPhone or iPad" }),
  ).toContainText("Add to Home Screen");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  const workerResponse = await request.get("/sw.js");
  expect(workerResponse.headers()["cache-control"]).toContain("no-cache");
  await page
    .getByLabel("Email address")
    .fill(`pwa-${crypto.randomUUID()}@example.com`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("playwright-test-password");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "New tracker", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "New tracker", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Private PWA tracker");
  await page
    .getByRole("button", { name: "Create tracker", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const cachedPaths = await page.evaluate(async () => {
    const paths: string[] = [];
    for (const name of await caches.keys())
      for (const request of await (await caches.open(name)).keys())
        paths.push(new URL(request.url).pathname);
    return paths;
  });
  expect(cachedPaths).toEqual(["/offline.html"]);
  await context.setOffline(true);
  await page.goto("/today");
  await expect(
    page.getByRole("heading", { name: "You’re offline." }),
  ).toBeVisible();
  await expect(page.getByText(/Your activity is saved online/)).toBeVisible();
  await expect(page.getByText("Private PWA tracker")).toHaveCount(0);
  await context.setOffline(false);
  await page.getByRole("link", { name: "Try again" }).click();
  await expect(
    page.getByRole("heading", { name: "Private PWA tracker", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByText("Install app", { exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: test.info().outputPath("pwa-install-mobile.png"),
    fullPage: true,
    animations: "disabled",
  });
});

test("theme previews cover the page canvas and mobile overscroll without blocking zoom", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/signup");
  await page
    .getByLabel("Email address")
    .fill(`canvas-${crypto.randomUUID()}@example.com`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("playwright-test-password");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  const assertCanvas = async (color: string) => {
    await expect(page.locator("html")).toHaveCSS("background-color", color);
    await expect(page.locator("body")).toHaveCSS("background-color", color);
    await expect(page.locator(".app")).toHaveCSS("background-color", color);
  };
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Appearance", exact: true }).click();
  for (const [theme, color, hex] of [
    ["pastel", "rgb(245, 241, 252)", "#f5f1fc"],
    ["terminal", "rgb(16, 23, 17)", "#101711"],
    ["brutalist", "rgb(255, 246, 219)", "#fff6db"],
    ["neumorphism", "rgb(237, 240, 243)", "#edf0f3"],
  ]) {
    await selectOption(page.getByLabel("Theme", { exact: true }), theme);
    await assertCanvas(color);
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
      "content",
      hex,
    );
  }
  await page
    .getByRole("button", { name: "Cancel preview", exact: true })
    .click();
  await assertCanvas("rgb(247, 245, 239)");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
    "content",
    "#f7f5ef",
  );
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Appearance", exact: true }).click();
  await selectOption(page.getByLabel("Theme", { exact: true }), "neumorphism");
  await page.getByRole("button", { name: "Save appearance" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await assertCanvas("rgb(237, 240, 243)");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
    "content",
    "#edf0f3",
  );
  await expect(page.locator("html")).toHaveCSS("overscroll-behavior", "none");
  await expect(page.locator("body")).toHaveCSS("overscroll-behavior", "none");
  await expect(page.locator("html")).toHaveCSS("touch-action", "auto");
  const viewport = await page
    .locator('meta[name="viewport"]')
    .getAttribute("content");
  expect(viewport).not.toMatch(/user-scalable=no|maximum-scale=1(?:,|$)/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: test.info().outputPath("theme-canvas-mobile.png"),
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("link", { name: "Agent connections" }).click();
  await assertCanvas("rgb(237, 240, 243)");
  await page.getByRole("link", { name: "Back to Today" }).click();
  await assertCanvas("rgb(237, 240, 243)");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(247, 245, 239)",
  );
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
    "content",
    "#f7f5ef",
  );
});
