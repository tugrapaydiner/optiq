import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("has no detectable accessibility violations in the editorial shell", async ({
  page,
}) => {
  await page.goto("/");

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
