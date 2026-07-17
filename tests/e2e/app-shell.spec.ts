import { expect, test } from "@playwright/test";

test("loads the focused Optiq homepage without console errors", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Visual lessons, made accessible.",
    }),
  ).toBeVisible();
  await expect(page.locator("main img")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Open Next.js Dev Tools" })).toHaveCount(
    0,
  );
  await expect(page.locator("footer .brand-logo-light")).toBeVisible();
  await expect(page.getByText("Optiq · Tugrap Turker Aydiner")).toBeVisible();

  const visualSystem = await page.evaluate(() => {
    const footerLogo = document.querySelector<HTMLElement>(".brand-logo-light");
    return {
      bodyFont: getComputedStyle(document.body).fontFamily,
      footerLogoFilter: footerLogo ? getComputedStyle(footerLogo).filter : "",
      footerLogoBlend: footerLogo
        ? getComputedStyle(footerLogo).mixBlendMode
        : "",
    };
  });

  expect(visualSystem.bodyFont).toContain("Manrope Variable");
  expect(visualSystem.footerLogoFilter).toContain("invert");
  expect(visualSystem.footerLogoBlend).toBe("lighten");
  expect(browserErrors).toEqual([]);
});

test("separates product, examples, and lesson creation", async ({ page }) => {
  await page.goto("/");

  const primaryNavigation = page.getByRole("navigation", {
    name: "Primary navigation",
  });
  await expect(
    primaryNavigation.getByRole("link", { name: "Product" }),
  ).toHaveAttribute("href", "/#product");
  await expect(
    primaryNavigation.getByRole("link", { name: "Examples" }),
  ).toHaveAttribute("href", "/examples");

  await primaryNavigation.getByRole("link", { name: "Examples" }).click();
  await expect(page).toHaveURL(/\/examples$/);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "See the visual. Explore the structure.",
    }),
  ).toBeVisible();
  await expect(page.locator("article.example-story")).toHaveCount(3);
  await expect(page.locator(".story-label")).toHaveCount(0);

  await page.goto("/");
  await page.locator("a.header-action").click();
  await expect(page).toHaveURL(/\/create$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Start with one visual." }),
  ).toBeVisible();
  await expect(page.locator(".studio-workspace")).toBeVisible();
  await expect(page.locator(".workspace")).toHaveCount(0);
});

test("reveals the skip link and supports native radio-key navigation", async ({
  page,
}) => {
  await page.goto("/create");

  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Skip to main content" });
  await expect(skipLink).toBeVisible();
  await expect(skipLink).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();

  const chartMode = page.getByRole("radio", { name: /^Chart/ });
  const processMode = page.getByRole("radio", { name: /^Process diagram/ });
  await chartMode.focus();
  await expect(chartMode).toBeFocused();

  await page.keyboard.press("ArrowDown");
  await expect(processMode).toBeChecked();
  await expect(processMode).toBeFocused();
});

test("does not create horizontal overflow across routes and widths", async ({
  page,
}) => {
  for (const route of ["/", "/examples", "/create"]) {
    for (const width of [1440, 1280, 1024, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(route);

      const dimensions = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));

      expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
    }
  }
});

test("provides an operable mobile menu and 44 CSS pixel touch targets", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const menu = page.locator("summary");
  await expect(menu).toBeVisible();
  await menu.click();
  await expect(
    page.getByRole("navigation", { name: "Mobile navigation" }),
  ).toBeVisible();

  const undersizedTargets = await page.evaluate(() =>
    Array.from(
      document.querySelectorAll<HTMLElement>(
        "a, button, summary, label.mode-option",
      ),
    )
      .map((element) => {
        const rectangle = element.getBoundingClientRect();
        return {
          height: rectangle.height,
          label: element.textContent?.trim().replace(/\s+/g, " ") ?? "",
          width: rectangle.width,
        };
      })
      .filter(
        (target) =>
          target.height > 0 &&
          target.width > 0 &&
          (target.height < 44 || target.width < 44),
      ),
  );

  expect(undersizedTargets).toEqual([]);
});

test("removes decorative motion when reduced motion is requested", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  const animationDurationMilliseconds = await page
    .locator(".hero-media")
    .evaluate((element) => {
      const duration = getComputedStyle(element).animationDuration;
      return duration.endsWith("ms")
        ? Number.parseFloat(duration)
        : Number.parseFloat(duration) * 1000;
    });

  expect(animationDurationMilliseconds).toBeLessThanOrEqual(0.01);
});
