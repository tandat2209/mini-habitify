import { selectOption } from "./select-option";
import { test, expect, type Page } from "@playwright/test";
async function addField(
  page: Page,
  label: string,
  type = "text",
  options?: string[],
) {
  await page.getByRole("button", { name: "Add field", exact: true }).click();
  const card = page.locator(".template-field-card").last();
  await card.getByLabel("Field label", { exact: true }).fill(label);
  await selectOption(card.getByLabel("Field type", { exact: true }), type);
  if (options)
    for (let index = 0; index < options.length; index++)
      await card
        .getByLabel(`Option ${index + 1}`, { exact: true })
        .fill(options[index]);
  return card;
}
test("builds reusable templates visually and preserves historical field versions", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("/signup");
  await page
    .getByLabel("Email address")
    .fill(`builder-${crypto.randomUUID()}@example.com`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("playwright-test-password");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Templates", exact: true }).click();
  await expect(page.getByLabel("Template definition")).not.toBeVisible();
  await page
    .getByRole("button", { name: "Create template", exact: true })
    .click();
  await expect(
    page.getByLabel("Template name", { exact: true }),
  ).toHaveAttribute("aria-invalid", "true");
  await expect(
    page.getByText("Add at least one field.", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Template name", { exact: true }).fill("My session");
  await page
    .getByLabel("Template description", { exact: true })
    .fill("Capture the details that matter");
  const summary = await addField(page, "Summary");
  await summary
    .getByLabel("Required when adding details", { exact: true })
    .check();
  const originalKey = await summary.getAttribute("data-field-key");
  await addField(page, "Score", "number");
  await addField(page, "Reference date", "date");
  await addField(page, "Mode", "select", ["Solo", "Solo"]);
  await addField(page, "Tags", "multi_select", ["New", "Review"]);
  await addField(page, "Items", "list");
  await addField(page, "Temporary");
  await page
    .getByRole("button", { name: "Remove field 7", exact: true })
    .click();
  await expect(page.locator(".template-field-card")).toHaveCount(6);
  await page
    .getByRole("button", { name: "Move field 2 up", exact: true })
    .click();
  await expect(
    page
      .locator(".template-field-card")
      .first()
      .getByLabel("Field label", { exact: true }),
  ).toHaveValue("Score");
  await page
    .getByRole("button", { name: "Move field 1 down", exact: true })
    .click();
  expect(
    await page
      .locator(".template-field-card")
      .first()
      .getAttribute("data-field-key"),
  ).toBe(originalKey);
  await page
    .getByRole("button", { name: "Create template", exact: true })
    .click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Give each option a different value." }),
  ).toBeVisible();
  await page
    .getByRole("group", { name: "Field 4", exact: true })
    .getByLabel("Option 2", { exact: true })
    .fill("Together");
  const preview = page.getByRole("region", { name: "Check-in preview" });
  await preview.getByLabel("Summary", { exact: true }).fill("Preview only");
  await preview.getByLabel("Score", { exact: true }).fill("2");
  await expect(preview.getByLabel("Mode", { exact: true })).toBeVisible();
  await expect(preview.getByLabel("New", { exact: true })).toBeVisible();
  await page.getByText("Advanced JSON", { exact: true }).click();
  await page.getByLabel("Template definition", { exact: true }).fill("{");
  await page.getByRole("button", { name: "Import JSON", exact: true }).click();
  await expect(
    page.getByText("Enter a valid JSON definition.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Template name", { exact: true })).toHaveValue(
    "My session",
  );
  await page.getByText("Advanced JSON", { exact: true }).click();
  await page.locator(".template-builder-grid").evaluate((element) => {
    element.scrollTop = 0;
  });
  await expect(
    page.getByRole("heading", { name: "Activity templates", exact: true }),
  ).toBeInViewport();
  await expect(
    page.getByRole("button", { name: "Create template", exact: true }),
  ).toBeInViewport();
  await page.screenshot({
    path: test.info().outputPath("visual-builder-desktop.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Create template", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "New tracker", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Daily activity");
  await selectOption(page.getByLabel("Activity template", { exact: true }), {
    label: "My session",
  });
  await page
    .getByRole("button", { name: "Create tracker", exact: true })
    .click();
  await page.getByRole("button", { name: "Check in", exact: true }).click();
  await page.getByRole("button", { name: "Add details", exact: true }).click();
  await expect(page.getByLabel("Summary", { exact: true })).toHaveValue("");
  await page
    .getByLabel("Summary", { exact: true })
    .fill("Actual saved details");
  await page.getByRole("button", { name: "Save details", exact: true }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Templates", exact: true }).click();
  await selectOption(page.getByLabel("Template to edit", { exact: true }), {
    label: "My session",
  });
  const first = page.locator(".template-field-card").first();
  expect(await first.getAttribute("data-field-key")).toBe(originalKey);
  await first
    .getByLabel("Field label", { exact: true })
    .fill("Session summary");
  await addField(page, "Reflection");
  await expect(
    page.getByText(
      "Changes apply to future check-ins. Previous entries stay unchanged.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "View Daily activity history", exact: true })
    .click();
  await expect(page.locator(".history-row")).toContainText(
    "Actual saved details",
  );
  await expect(page.locator(".history-row")).not.toContainText("Preview only");
  await page.getByRole("button", { name: /Edit entry on/ }).click();
  await expect(page.getByLabel("Summary", { exact: true })).toHaveValue(
    "Actual saved details",
  );
  await expect(page.getByLabel("Session summary", { exact: true })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Templates", exact: true }).click();
  await selectOption(page.getByLabel("Template to edit", { exact: true }), {
    label: "My session",
  });
  await page.getByRole("button", { name: "Preview form", exact: true }).click();
  await expect(
    preview.getByLabel("Session summary", { exact: true }),
  ).toBeVisible();
  await expect(preview.getByLabel("Reflection", { exact: true })).toBeVisible();
  await page.locator(".template-builder-grid").evaluate((element) => {
    element.scrollTop = 0;
  });
  await expect(
    page.getByRole("heading", { name: "Activity templates", exact: true }),
  ).toBeInViewport();
  await expect(
    page.getByRole("button", { name: "Save changes", exact: true }),
  ).toBeInViewport();
  await page.screenshot({
    path: test.info().outputPath("visual-builder-mobile-preview.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Build form", exact: true }).click();
  await first.getByLabel("Field label", { exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(first.getByLabel("Field type", { exact: true })).toBeFocused();
  expect(
    await page
      .getByRole("dialog")
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
});

test("mobile template builder supports long text and bounded ratings with keyboard", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/signup");
  await page
    .getByLabel("Email address")
    .fill(`rating-${crypto.randomUUID()}@example.com`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("playwright-test-password");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Templates", exact: true }).click();
  await page.getByLabel("Template name", { exact: true }).fill("Book Reading");
  await addField(page, "What I learned", "textarea");
  const rating = await addField(page, "Understanding", "rating");
  await expect(rating.getByLabel("Minimum rating")).toHaveValue("1");
  await expect(rating.getByLabel("Maximum rating")).toHaveValue("5");
  await rating.getByLabel("Minimum rating").focus();
  await page.keyboard.press("Tab");
  await expect(rating.getByLabel("Maximum rating")).toBeFocused();
  await page.getByRole("button", { name: "Preview form", exact: true }).click();
  const preview = page.getByRole("region", { name: "Check-in preview" });
  await preview
    .getByLabel("What I learned", { exact: true })
    .fill("Transaction isolation\nQuestions for later");
  await expect(
    preview.getByLabel("Understanding", { exact: true }),
  ).toHaveAttribute("min", "1");
  await expect(
    preview.getByLabel("Understanding", { exact: true }),
  ).toHaveAttribute("max", "5");
  await preview.getByLabel("Understanding", { exact: true }).fill("4");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/tmp/mini-habitify-rating-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Create template", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Templates", exact: true }).click();
  await selectOption(page.getByLabel("Template to edit", { exact: true }), {
    label: "Book Reading",
  });
  await page.getByRole("button", { name: "Preview form", exact: true }).click();
  await expect(
    preview.getByLabel("Understanding", { exact: true }),
  ).toHaveAttribute("max", "5");
});
