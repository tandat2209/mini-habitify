import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import {
  dateInTimezone,
  shiftDate,
} from "../../src/features/tracker-engine/engine";
import { reviewWindow } from "../../src/features/review/review";
process.loadEnvFile(".env.local");

test("weekly review reads persisted activity, details, comparisons, and private history on mobile", async ({
  page,
  browser,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) =>
    pageErrors.push(error.message.split("\n")[0]),
  );
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
  const email = `review-${crypto.randomUUID()}@example.com`;
  const password = "review-test-password";
  const signup = await client.auth.signUp({
    email,
    password,
    options: { data: { timezone: "Asia/Ho_Chi_Minh" } },
  });
  expect(signup.error).toBeNull();
  const today = dateInTimezone(new Date(), "Asia/Ho_Chi_Minh");
  const window = reviewWindow(undefined, today);
  const published = await client.rpc("publish_activity_template", {
    p_template: null,
    p_name: "Review notes",
    p_description: "",
    p_fields: [{ key: "notes", label: "Session notes", type: "text" }],
  });
  expect(published.error).toBeNull();
  const template = await client
    .from("activity_templates")
    .select("id,current_version_id")
    .eq("user_id", signup.data.user!.id)
    .single();
  expect(template.error).toBeNull();
  const inserted = await client
    .from("trackers")
    .insert(
      [
        {
          user_id: signup.data.user!.id,
          name: "Review reading",
          type: "habit",
          target: 3,
          goal_period: "weekly",
          created_at: `${shiftDate(window.start, -14)}T00:00:00Z`,
          activity_template_id: template.data!.id,
        },
        {
          user_id: signup.data.user!.id,
          name: "Review water",
          type: "counter",
          target: null,
          created_at: `${shiftDate(window.start, -14)}T00:00:00Z`,
        },
        {
          user_id: signup.data.user!.id,
          name: "Review focus",
          type: "duration",
          target: null,
          created_at: `${shiftDate(window.start, -14)}T00:00:00Z`,
        },
        {
          user_id: signup.data.user!.id,
          name: "Review weight",
          type: "numeric",
          target: null,
          unit: "kg",
          created_at: `${shiftDate(window.start, -14)}T00:00:00Z`,
        },
      ].map((row) => ({
        unit: "",
        goal_period: "daily",
        activity_template_id: null,
        ...row,
      })),
    )
    .select();
  expect(inserted.error).toBeNull();
  for (const tracker of inserted.data!) {
    for (const [date, value] of [
      [
        today,
        tracker.type === "duration" ? 900 : tracker.type === "numeric" ? 0 : 1,
      ],
      [window.previousEnd, tracker.type === "numeric" ? 2 : 1],
    ] as const) {
      const result = await client.rpc("record_log_with_details", {
        p_tracker: tracker.id,
        p_date: date,
        p_value: value,
        p_id: crypto.randomUUID(),
        p_details:
          tracker.type === "habit" ? { notes: "Read about replication" } : {},
        p_template_version:
          tracker.type === "habit" ? template.data!.current_version_id : null,
      });
      expect(result.error).toBeNull();
    }
  }
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("link", { name: "Weekly review" }).click();
  await expect(
    page.getByRole("heading", { name: "Weekly review", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("In progress", { exact: true })).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Weekly check-ins" })
      .locator("svg.recharts-surface"),
  ).toBeVisible();
  await expect(
    page
      .getByRole("figure", { name: "Review focus daily comparison" })
      .locator("svg.recharts-surface"),
  ).toBeVisible();
  await expect(
    page
      .getByRole("figure", { name: "Review weight daily comparison" })
      .locator(".recharts-line"),
  ).toHaveCount(2);
  await expect(
    page.getByText("A little space to notice what you’ve been doing."),
  ).toHaveCount(0);
  expect(pageErrors).toEqual([]);
  const reading = page.getByRole("article").filter({
    has: page.getByRole("heading", { name: "Review reading", exact: true }),
  });
  await expect(reading.getByText("1 / 3", { exact: false })).toBeVisible();
  await reading.getByText("View 1 entry", { exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(reading.getByText("Read about replication")).toBeVisible();
  await expect(
    page
      .getByRole("article")
      .filter({ hasText: "Review focus" })
      .locator(".review-value"),
  ).toHaveText("15 min");
  await expect(
    page
      .getByRole("article")
      .filter({ hasText: "Review weight" })
      .locator(".review-value"),
  ).toHaveText("0 kg");
  await page.screenshot({
    path: "test-results/review-desktop.png",
    fullPage: true,
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Review reading", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Weekly check-ins" })
      .locator("svg.recharts-surface"),
  ).toBeVisible();
  expect(pageErrors).toEqual([]);
  await page.getByRole("link", { name: "Previous week", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`week=${window.previousStart}`));
  await expect(page.getByText("Completed week", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Back to this week" }).click();
  await expect(
    page.getByRole("button", { name: "Next week", exact: true }),
  ).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/review-mobile.png",
    fullPage: true,
  });
  await page.goto("/review?week=2026-02-30");
  await expect(page.getByText("In progress", { exact: true })).toBeVisible();
  // Cross the API's 1,000-row cap without changing the observed total.
  const water = inserted.data!.find((tracker) => tracker.type === "counter")!;
  const extraEntries = await client.from("tracker_logs").insert(
    Array.from({ length: 1001 }, () => ({
      id: crypto.randomUUID(),
      user_id: signup.data.user!.id,
      tracker_id: water.id,
      tracker_type: "counter",
      tracking_date: today,
      value: 0,
    })),
  );
  expect(extraEntries.error).toBeNull();
  await page.reload();
  const waterCard = page.getByRole("article").filter({
    has: page.getByRole("heading", { name: "Review water", exact: true }),
  });
  await waterCard.getByText("View 1002 entries", { exact: true }).click();
  await expect(waterCard.locator("li")).toHaveCount(20);
  await waterCard.getByRole("button", { name: "Show more entries" }).click();
  await expect(waterCard.locator("li")).toHaveCount(40);
  await expect(waterCard.locator(".review-value")).toHaveText("1");
  await waterCard.getByText("View 1002 entries", { exact: true }).click();
  for (const theme of [
    "terminal",
    "pastel",
    "brutalist",
    "neumorphism",
    "paper",
  ]) {
    const saved = await client
      .from("user_preferences")
      .update({
        theme,
        layout: "compact",
        presentation: theme === "terminal" ? "developer" : "playful",
      })
      .eq("user_id", signup.data.user!.id);
    expect(saved.error).toBeNull();
    await page.reload();
    await expect(page.locator(".app")).toHaveAttribute("data-theme", theme);
    await expect(waterCard.locator(".review-value")).toHaveText("1");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  const archived = await client
    .from("trackers")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", inserted.data!.find((tracker) => tracker.type === "habit")!.id);
  expect(archived.error).toBeNull();
  await page.reload();
  await expect(reading.getByText("Archived", { exact: true })).toBeVisible();
  await reading.getByText("View 1 entry", { exact: true }).click();
  await expect(reading.getByText("Read about replication")).toBeVisible();
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await otherPage.goto("/review");
  await expect(otherPage).toHaveURL(/\/login/);
  await otherPage.goto("/signup");
  await otherPage
    .getByLabel("Email address")
    .fill(`review-other-${crypto.randomUUID()}@example.com`);
  await otherPage.getByLabel("Password", { exact: true }).fill(password);
  await otherPage
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await otherPage.getByRole("link", { name: "Weekly review" }).click();
  await expect(
    otherPage.getByText("A fresh page for your week."),
  ).toBeVisible();
  await expect(
    otherPage.getByText("Review reading", { exact: true }),
  ).toHaveCount(0);
  await expect(otherPage.getByText("Read about replication")).toHaveCount(0);
  await other.close();
  expect(pageErrors).toEqual([]);
});
