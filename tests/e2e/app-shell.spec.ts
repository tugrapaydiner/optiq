import { expect, test } from "@playwright/test";

const routes = [
  "/",
  "/product",
  "/how-it-works",
  "/accessibility",
  "/examples",
  "/create",
] as const;

test("loads the focused Optiq homepage without console issues", async ({ page }) => {
  const browserIssues: string[] = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      browserIssues.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => browserIssues.push(`pageerror: ${error.message}`));

  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Visual lessons, made accessible.",
    }),
  ).toBeVisible();
  await expect(page.locator("main img")).toHaveCount(1);
  await expect(page.locator("footer .brand-logo-light")).toBeVisible();
  await expect(page.getByText("Optiq · Tugrap Turker Aydiner")).toBeVisible();
  expect(browserIssues).toEqual([]);
});

test("gives every primary navigation item a distinct page", async ({ page }) => {
  test.setTimeout(60_000);

  const destinations = [
    ["Product", "/product", "Keep the visual. Change the access."],
    ["How it works", "/how-it-works", "Four deliberate stages. One accountable path."],
    ["Accessibility", "/accessibility", "Access starts in the structure."],
    ["Examples", "/examples", "See the visual. Explore the structure."],
  ] as const;

  await page.goto("/");
  const primaryNavigation = page.getByRole("navigation", {
    name: "Primary navigation",
  });

  for (const [label, href] of destinations) {
    await expect(primaryNavigation.getByRole("link", { name: label })).toHaveAttribute(
      "href",
      href,
    );
  }

  for (const [label, href, heading] of destinations) {
    await page.goto("/");
    await page
      .getByRole("navigation", { name: "Primary navigation" })
      .getByRole("link", { name: label })
      .click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  }

  await page.goto("/");
  await page.locator("a.header-action").click();
  await expect(page).toHaveURL(/\/create$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Create a lesson." }),
  ).toBeVisible();
});

test("uses horizontal forward and backward route motion", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Primary navigation" })
    .getByRole("link", { name: "Product" })
    .click();
  await expect(page).toHaveURL(/\/product$/);

  const forwardMotion = await page.locator(".route-frame").evaluate((element) => {
    const animation = element.getAnimations()[0];
    const keyframes = (animation?.effect as KeyframeEffect | null)?.getKeyframes() ?? [];
    return {
      animationName: getComputedStyle(element).animationName,
      direction: document.documentElement.dataset.routeDirection,
      firstTransform: String(keyframes[0]?.transform ?? ""),
    };
  });

  expect(forwardMotion.direction).toBe("forward");
  expect(forwardMotion.animationName).toBe("route-enter-forward");
  expect(forwardMotion.firstTransform).toContain("translateX");
  expect(forwardMotion.firstTransform).not.toContain("translateY");

  await page.getByRole("link", { name: "Optiq home" }).first().click();
  await expect(page).toHaveURL(/\/$/);

  const backwardMotion = await page.locator(".route-frame").evaluate((element) => {
    const animation = element.getAnimations()[0];
    const keyframes = (animation?.effect as KeyframeEffect | null)?.getKeyframes() ?? [];
    return {
      animationName: getComputedStyle(element).animationName,
      direction: document.documentElement.dataset.routeDirection,
      firstTransform: String(keyframes[0]?.transform ?? ""),
    };
  });

  expect(backwardMotion.direction).toBe("backward");
  expect(backwardMotion.animationName).toBe("route-enter-backward");
  expect(backwardMotion.firstTransform).toContain("translateX");
  expect(backwardMotion.firstTransform).not.toContain("translateY");
});

test("aligns information and next-page rows across editorial routes", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });

  const routeEndings: Array<{
    contentHeight: number;
    footerTop: number;
    nextTop: number;
  }> = [];

  for (const route of ["/product", "/how-it-works", "/accessibility", "/examples"]) {
    await page.goto(route);
    routeEndings.push(
      await page.evaluate(() => ({
        contentHeight:
          document.querySelector(".information-content")?.getBoundingClientRect()
            .height ?? 0,
        footerTop: document.querySelector("footer")?.getBoundingClientRect().top ?? 0,
        nextTop:
          document.querySelector(".page-close")?.getBoundingClientRect().top ?? 0,
      })),
    );
  }

  expect(new Set(routeEndings.map(({ contentHeight }) => contentHeight)).size).toBe(1);
  expect(new Set(routeEndings.map(({ nextTop }) => nextTop)).size).toBe(1);
  expect(new Set(routeEndings.map(({ footerTop }) => footerTop)).size).toBe(1);
  expect(routeEndings[0]?.footerTop).toBeGreaterThan(900);
});

test("keeps the rebuilt studio native, editorial, and keyboard operable", async ({
  page,
}) => {
  await page.goto("/create");

  await expect(page.locator(".studio-workspace")).toBeVisible();
  await expect(page.locator(".source-kind")).toBeVisible();
  await expect(page.locator(".upload-editorial")).toBeVisible();

  const workspaceLayout = await page.locator(".studio-workspace").evaluate((workspace) => ({
    bottom: workspace.getBoundingClientRect().bottom,
    viewportHeight: window.innerHeight,
  }));
  expect(workspaceLayout.bottom).toBeLessThanOrEqual(workspaceLayout.viewportHeight);

  const chartMode = page.getByRole("radio", { name: /^Chart/ });
  const processMode = page.getByRole("radio", { name: /^Process diagram/ });
  await chartMode.focus();
  await page.keyboard.press("ArrowDown");
  await expect(processMode).toBeChecked();
  await expect(processMode).toBeFocused();

  await expect(page.getByRole("button", { name: "Choose a file" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Analyze source" })).toBeDisabled();
  await expect(
    page.getByText("Analysis is unavailable in this static preview."),
  ).toBeVisible();
});

test("reveals the skip link and transfers focus to the page", async ({ page }) => {
  await page.goto("/create");

  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Skip to main content" });
  await expect(skipLink).toBeVisible();
  await expect(skipLink).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
});

test("does not create horizontal overflow across routes and widths", async ({
  page,
}) => {
  test.setTimeout(90_000);

  for (const route of routes) {
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
  await page.goto("/create");

  const menu = page.locator("summary");
  await expect(menu).toBeVisible();
  await menu.click();
  await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toBeVisible();

  const undersizedTargets = await page.evaluate(() =>
    Array.from(
      document.querySelectorAll<HTMLElement>(
        "a, button, summary, label.source-choice",
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

test("removes horizontal route motion when reduced motion is requested", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("link", { name: "Explore the product" }).click();
  await expect(page).toHaveURL(/\/product$/);

  const animationDurationMilliseconds = await page
    .locator(".route-frame")
    .evaluate((element) => {
      const duration = getComputedStyle(element).animationDuration;
      return duration.endsWith("ms")
        ? Number.parseFloat(duration)
        : Number.parseFloat(duration) * 1000;
    });

  expect(animationDurationMilliseconds).toBeLessThanOrEqual(0.01);
});
