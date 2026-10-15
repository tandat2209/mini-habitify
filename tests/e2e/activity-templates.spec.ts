import { selectOption } from "./select-option";
import { test, expect } from "@playwright/test";
const definition = {
  name: "Session notes",
  description: "Record what you did",
  fields: [
    { key: "summary", label: "Summary", type: "text", required: true },
    { key: "rating", label: "Rating", type: "number" },
    { key: "reference_date", label: "Reference date", type: "date" },
    {
      key: "mode",
      label: "Mode",
      type: "select",
      options: ["Solo", " Together "],
    },
    {
      key: "tags",
      label: "Tags",
      type: "multi_select",
      options: ["New", "Review"],
    },
    { key: "items", label: "Items", type: "list" },
  ],
};
test("reusable templates, progress-only check-ins, details editing and immutable history", async ({
  page,
}) => {
  await page.goto("/signup");
  await page
    .getByLabel("Email address")
    .fill(`journal-${crypto.randomUUID()}@example.com`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("playwright-test-password");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A little progress, every day." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Templates", exact: true }).click();
  await page.getByText("Advanced JSON", { exact: true }).click();
  await page.getByLabel("Template definition").fill(JSON.stringify(definition));
  await page.getByRole("button", { name: "Import JSON", exact: true }).click();
  await page
    .getByRole("button", { name: "Create template", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  for (const name of ["Practice", "Another activity"]) {
    await page
      .getByRole("button", { name: "New tracker", exact: true })
      .click();
    await page.getByLabel("Name", { exact: true }).fill(name);
    await selectOption(page.getByLabel("Activity template", { exact: true }), {
      label: "Session notes",
    });
    await page
      .getByRole("button", { name: "Create tracker", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  const card = page.getByRole("article").filter({
    has: page.getByRole("heading", { name: "Practice", exact: true }),
  });
  await card.getByRole("button", { name: "Check in", exact: true }).click();
  await expect(
    card.getByRole("button", { name: "Undo check-in" }),
  ).toBeVisible();
  await card.getByRole("button", { name: "Add details", exact: true }).click();
  await card.getByLabel("Rating", { exact: true }).fill("0");
  await card.getByRole("button", { name: "Save details", exact: true }).click();
  await expect(card.getByRole("alert")).toContainText(
    "Check the activity details",
  );
  await card
    .getByLabel("Summary", { exact: true })
    .fill("Worked through examples");
  await card.getByLabel("Reference date", { exact: true }).fill("2026-10-14");
  await card.getByLabel("Mode", { exact: true }).click();
  const together = page.getByRole("option", { name: "Together", exact: true });
  await expect(together).toHaveAttribute("data-value", " Together ");
  await together.click();
  await card.getByLabel("New", { exact: true }).check();
  await card.getByLabel("Items", { exact: true }).fill("First\nSecond");
  await card.getByRole("button", { name: "Save details", exact: true }).click();
  await expect(card.getByLabel("Summary", { exact: true })).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: "View Practice history" }).click();
  await expect(page.locator(".history-row")).toContainText(
    "Worked through examples",
  );
  await expect(page.locator(".history-row")).toContainText("Together");
  await page
    .getByRole("button", { name: "Edit entry on", exact: false })
    .click();
  await expect(page.getByLabel("Summary", { exact: true })).toHaveValue(
    "Worked through examples",
  );
  await page.getByLabel("Summary", { exact: true }).fill("Edited original");
  await page.getByRole("button", { name: "Save entry", exact: true }).click();
  await expect(page.locator(".history-row")).toContainText("Edited original");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Templates", exact: true }).click();
  await selectOption(page.getByLabel("Template to edit"), {
    label: "Session notes",
  });
  await page.getByText("Advanced JSON", { exact: true }).click();
  await page.getByLabel("Template definition").fill(
    JSON.stringify({
      ...definition,
      fields: [{ key: "new_note", label: "New note", type: "text" }],
    }),
  );
  await page.getByRole("button", { name: "Import JSON", exact: true }).click();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const second = page.getByRole("article").filter({
    has: page.getByRole("heading", { name: "Another activity", exact: true }),
  });
  await second
    .getByRole("button", { name: "Add details", exact: true })
    .click();
  await expect(second.getByLabel("Summary", { exact: true })).toHaveCount(0);
  await second
    .getByLabel("New note", { exact: true })
    .fill("Current version entry");
  await second
    .getByRole("button", { name: "Save check-in", exact: true })
    .click();
  await page
    .getByRole("button", { name: "View Another activity history" })
    .click();
  await expect(page.locator(".history-row")).toContainText(
    "Current version entry",
  );
  await expect(page.locator(".history-row")).toContainText("New note");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "View Practice history" }).click();
  await expect(page.locator(".history-row")).toContainText("Summary");
  await page
    .getByRole("button", { name: "Edit entry on", exact: false })
    .click();
  await expect(page.getByLabel("Summary", { exact: true })).toHaveValue(
    "Edited original",
  );
  await expect(page.getByLabel("New note", { exact: true })).toHaveCount(0);
  await page
    .getByLabel("Summary", { exact: true })
    .fill("Edited after publication");
  await page.getByRole("button", { name: "Save entry", exact: true }).click();
  await page.getByRole("button", { name: "Edit tracker", exact: true }).click();
  await selectOption(page.getByLabel("Activity template", { exact: true }), "");
  await page.getByRole("button", { name: "Save tracker", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "View Practice history" }).click();
  await expect(page.locator(".history-row")).toContainText(
    "Edited after publication",
  );
  await page.getByRole("link", { name: "Open full history" }).click();
  await expect(page).toHaveURL(/\/today\/trackers\//);
  await expect(
    page.getByRole("heading", { name: "Practice", exact: true, level: 1 }),
  ).toBeVisible();
  await expect(page.locator(".history-row")).toContainText(
    "Edited after publication",
  );
  await page.screenshot({
    path: test.info().outputPath("history-desktop.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".history-row")).toContainText(
    "Edited after publication",
  );
  await page
    .getByRole("button", { name: "Edit entry on", exact: false })
    .click();
  await page.getByLabel("Summary", { exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Rating", { exact: true })).toBeFocused();
  await page.getByLabel("Summary", { exact: true }).fill("Mobile edit");
  await page.getByRole("button", { name: "Save entry", exact: true }).click();
  await expect(page.locator(".history-row")).toContainText("Mobile edit");
  await page.screenshot({
    path: test.info().outputPath("history-mobile.png"),
    fullPage: true,
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
