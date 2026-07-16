import { expect, test } from "@playwright/test";

test("loads the Optiq shell and main heading", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Turn educational visuals into accessible lessons",
    }),
  ).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test("reveals the skip link and supports native radio-key navigation", async ({
  page,
}) => {
  await page.goto("/");

  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Skip to main content" });
  await expect(skipLink).toBeVisible();
  await expect(skipLink).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();

  await page.keyboard.press("Tab");
  const chartMode = page.getByRole("radio", { name: /^Chart/ });
  const processMode = page.getByRole("radio", { name: /^Process diagram/ });
  await expect(chartMode).toBeFocused();

  await page.keyboard.press("ArrowDown");
  await expect(processMode).toBeChecked();
  await expect(processMode).toBeFocused();
});

test("does not create horizontal overflow at a 390 CSS pixel viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
});
