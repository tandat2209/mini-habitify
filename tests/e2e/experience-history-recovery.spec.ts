import { test, expect, type Page } from "@playwright/test";
async function signup(page: Page) {
  const email = `features-${crypto.randomUUID()}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Email address").fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("feature-test-password");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A little progress, every day." }),
  ).toBeVisible();
  return email;
}
test("presets and all widget settings persist without changing check-ins", async ({
  page,
}) => {
  await signup(page);
  await page.getByRole("button", { name: "New tracker", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Read");
  await page
    .getByRole("button", { name: "Create tracker", exact: true })
    .click();
  const card = page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: "Read", exact: true }) });
  await card.getByRole("button", { name: "Check in", exact: true }).click();
  await expect(
    card.getByRole("button", { name: "Undo check-in" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Appearance", exact: true }).click();
  await page.getByLabel("Experience preset").selectOption("developer");
  await page.getByLabel("Show daily summary").uncheck();
  await page.getByRole("button", { name: "Move Recent activity up" }).click();
  await page.getByRole("button", { name: "Save appearance" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(
    page.locator('[data-presentation="developer"][data-layout="compact"]'),
  ).toBeVisible();
  expect(
    await page
      .locator("[data-widget]")
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("data-widget"))),
  ).toEqual(["activity", "recent"]);
  await expect(
    card.getByRole("button", { name: "Undo check-in" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Appearance", exact: true }).click();
  await page.getByLabel("Experience preset").selectOption("playful");
  await page.getByRole("button", { name: "Save appearance" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator('[data-widget="recent"]')).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Your little steps" }),
  ).toBeVisible();
});
test("full history supports month navigation and date filters", async ({
  page,
}) => {
  await signup(page);
  await page.getByRole("button", { name: "New tracker", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Read");
  await page
    .getByRole("button", { name: "Create tracker", exact: true })
    .click();
  await page.getByRole("button", { name: "Check in", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Undo check-in" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "View Read history" }).click();
  await page.getByRole("link", { name: "Open full history" }).click();
  await expect(page).toHaveURL(/\/today\/trackers\//);
  await expect(
    page.getByRole("heading", { name: "Read", exact: true, level: 1 }),
  ).toBeVisible();
  await expect(page.locator(".history-row")).toHaveCount(1);
  await page.getByRole("button", { name: "Previous month" }).click();
  await expect(page.locator(".history-row")).toHaveCount(0);
  await page.getByRole("button", { name: "Next month" }).click();
  await expect(page.locator(".history-row")).toHaveCount(1);
  await page.getByLabel("History from").fill("2099-01-01");
  await expect(
    page.getByText("The start date must be before the end date."),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".history-row")).toHaveCount(1);
  const otherContext = await page.context().browser()!.newContext();
  const otherPage = await otherContext.newPage();
  await signup(otherPage);
  await otherPage.goto(page.url());
  // Next.js keeps status 200 once a streamed page starts; verify the denied UI and absence of private data.
  await expect(
    otherPage.getByRole("heading", { name: "404", exact: true }),
  ).toBeVisible();
  await expect(
    otherPage.getByRole("heading", { name: "Read", exact: true }),
  ).toHaveCount(0);
  await otherContext.close();
});
test("password recovery email changes the password and protects reset pages", async ({
  page,
  request,
  baseURL,
}) => {
  test.setTimeout(60000);
  const email = await signup(page);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page).toHaveURL(/\/forgot-password/);
  await expect(
    page.getByRole("heading", { name: "A little help signing in." }),
  ).toBeVisible();
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(
    page.getByText(
      "If an account uses this email, a reset link is on its way.",
    ),
  ).toBeVisible();
  let messageId = "";
  await expect
    .poll(async () => {
      const r = await request.get(
        `http://127.0.0.1:54324/api/v1/search?query=${encodeURIComponent("to:" + email)}`,
      );
      const body = await r.json();
      messageId = body.messages?.[0]?.ID ?? "";
      return messageId;
    })
    .not.toBe("");
  const response = await request.get(
    `http://127.0.0.1:54324/api/v1/message/${messageId}`,
  );
  const message = await response.json();
  const deliveredLink = String(message.HTML)
    .match(/href="([^"]+)"/)?.[1]
    ?.replaceAll("&amp;", "&");
  expect(deliveredLink).toBeTruthy();
  // Exercise the real delivered token on this test server, including alternate ports.
  const target = new URL(deliveredLink!);
  const testOrigin = new URL(baseURL!);
  target.host = testOrigin.host;
  target.protocol = testOrigin.protocol;
  const link = target.toString();
  await page.goto(link!);
  await expect(
    page.getByRole("heading", { name: "A fresh password." }),
  ).toBeVisible();
  await page
    .getByLabel("New password", { exact: true })
    .fill("new-feature-password");
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("new-feature-password");
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Email address").fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("new-feature-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A little progress, every day." }),
  ).toBeVisible();
  await page.goto(link!);
  await expect(
    page.getByText(
      "Your reset link has expired or was already used. Request a fresh one below.",
    ),
  ).toBeVisible();
  const clean = await page.context().browser()!.newContext();
  const unauth = await clean.newPage();
  await unauth.goto(new URL("/reset-password", baseURL).toString());
  await expect(
    unauth.getByRole("heading", { name: "Request a fresh reset link." }),
  ).toBeVisible();
  await clean.close();
});
