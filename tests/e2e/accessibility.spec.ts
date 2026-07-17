import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const route of [
  "/",
  "/product",
  "/how-it-works",
  "/accessibility",
  "/examples",
  "/create",
]) {
  test(`has no detectable accessibility violations on ${route}`, async ({
    page,
  }) => {
    test.setTimeout(60_000);

    await page.goto(route);

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
}

test("has no detectable accessibility violations in the chart success state", async ({
  page,
}) => {
  const consoleIssues: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      consoleIssues.push(`${message.type()}: ${message.text()}`);
    }
  });

  await page.goto("/create");
  await page.getByRole("button", { name: "Open" }).click();
  await expect(page.getByRole("table")).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
  expect(consoleIssues).toEqual([]);
});
