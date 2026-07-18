import { resolve } from "node:path";

import { expect, test } from "@playwright/test";

import chartFixture from "../../fixtures/gold/chart-bar-01.json";
import { SONIFICATION_TIMING } from "../../src/lib/sonification";

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
  test.setTimeout(60_000);
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Primary navigation" })
    .getByRole("link", { name: "Product" })
    .click();
  await expect(page).toHaveURL(/\/product$/, { timeout: 15_000 });

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

  await page
    .locator("header")
    .getByRole("link", { name: "Optiq home" })
    .click();
  await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });

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

test("aligns content and page navigation rows across routed pages", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1280, height: 900 });

  const routeEndings: Array<{
    contentHeight: number;
    footerTop: number;
    nextTop: number;
  }> = [];

  for (const route of [
    "/product",
    "/how-it-works",
    "/accessibility",
    "/examples",
    "/create",
  ]) {
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

test("provides accurate previous and next page navigation", async ({ page }) => {
  test.setTimeout(90_000);
  const pageNavigation = [
    ["/product", "/", "Previous: Home", "/how-it-works", "Next: How it works"],
    [
      "/how-it-works",
      "/product",
      "Previous: Product",
      "/accessibility",
      "Next: Accessibility",
    ],
    [
      "/accessibility",
      "/how-it-works",
      "Previous: How it works",
      "/examples",
      "Next: Examples",
    ],
    [
      "/examples",
      "/accessibility",
      "Previous: Accessibility",
      "/create",
      "Next: Create a lesson",
    ],
  ] as const;

  for (const [route, previousHref, previousName, nextHref, nextName] of pageNavigation) {
    await page.goto(route);
    const navigation = page.getByRole("navigation", { name: "Page navigation" });
    await expect(navigation.getByRole("link", { name: previousName })).toHaveAttribute(
      "href",
      previousHref,
    );
    await expect(navigation.getByRole("link", { name: nextName })).toHaveAttribute(
      "href",
      nextHref,
    );
  }

  await page.goto("/create");
  const createNavigation = page.getByRole("navigation", { name: "Page navigation" });
  await expect(
    createNavigation.getByRole("link", { name: "Previous: Examples" }),
  ).toHaveAttribute("href", "/examples");
  await expect(createNavigation.getByRole("link")).toHaveCount(1);

  await page.goto("/accessibility");
  await page
    .getByRole("navigation", { name: "Page navigation" })
    .getByRole("link", { name: "Next: Examples" })
    .click();
  await expect(page).toHaveURL(/\/examples$/, { timeout: 15_000 });
  await page
    .getByRole("navigation", { name: "Page navigation" })
    .getByRole("link", { name: "Previous: Accessibility" })
    .click();
  await expect(page).toHaveURL(/\/accessibility$/, { timeout: 15_000 });
});

test("keeps the rebuilt studio native, editorial, and keyboard operable", async ({
  page,
}) => {
  await page.route("**/api/analyze", async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        lesson: chartFixture,
        mode: "chart",
        ok: true,
        provider: "fixture",
        requestId: "e2e-request",
      }),
      contentType: "application/json",
      status: 200,
    });
  });
  await page.goto("/create");

  await expect(page.locator(".studio-workspace")).toBeVisible();
  await expect(page.locator(".source-kind")).toBeVisible();
  await expect(page.locator(".upload-editorial")).toBeVisible();

  const workspaceLayout = await page.locator(".studio-workspace").evaluate((workspace) => {
    const pageClose = document.querySelector(".page-close");
    return {
      bottom: workspace.getBoundingClientRect().bottom,
      pageCloseTop: pageClose?.getBoundingClientRect().top ?? 0,
      viewportHeight: window.innerHeight,
    };
  });
  expect(workspaceLayout.bottom).toBeLessThanOrEqual(workspaceLayout.pageCloseTop);
  expect(workspaceLayout.pageCloseTop).toBeGreaterThan(workspaceLayout.viewportHeight);
  expect(workspaceLayout.pageCloseTop - workspaceLayout.viewportHeight).toBeLessThanOrEqual(
    80,
  );

  const chartMode = page.getByRole("radio", { name: /^Chart/ });
  const processMode = page.getByRole("radio", { name: /^Process diagram/ });
  await chartMode.focus();
  await page.keyboard.press("ArrowDown");
  await expect(processMode).toBeChecked();
  await expect(processMode).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(chartMode).toBeChecked();
  await expect(chartMode).toBeFocused();

  await expect(page.getByRole("button", { name: "Choose a file" })).toBeEnabled();
  await expect(page.getByLabel("Image file")).toHaveAttribute("tabindex", "-1");
  const analyze = page.getByRole("button", { name: "Analyze source" });
  await expect(analyze).toBeDisabled();

  await page
    .getByLabel("Image file")
    .setInputFiles(resolve("fixtures/images/chart-bar-01.png"));
  await expect(page.getByAltText("Preview of the selected source image")).toBeVisible();
  await expect(page.getByRole("button", { name: "Replace" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Remove" })).toBeEnabled();
  await expect(analyze).toBeEnabled();
  await expect(analyze).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(page.getByText("Built-in sample draft")).toBeVisible();
  await expect(page.getByText("Draft only. Teacher review comes next.")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: chartFixture.title }),
  ).toBeVisible();

  const remove = page.getByRole("button", { name: "Remove" });
  await remove.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Choose a file" })).toBeFocused();
  await expect(analyze).toBeDisabled();
  await expect(page.getByRole("region", { name: "Analysis result" })).toHaveCount(0);
});

test("opens and explores a multi-series chart sample by keyboard", async ({ page }) => {
  await page.goto("/create");

  const sample = page.getByRole("combobox", { name: "Built-in chart" });
  await expect(sample).toHaveValue("chart-bar-02");
  const openSample = page.getByRole("button", { name: "Open" });
  await openSample.focus();
  await page.keyboard.press("Enter");

  await expect(
    page.getByRole("heading", { name: "Review the extracted lesson" }),
  ).toBeFocused();
  await expect(
    page.getByRole("heading", { name: "Plant height by light condition" }),
  ).toBeVisible();
  await expect(
    page.getByRole("table", {
      name: "Plant height by light condition — exact values",
    }),
  ).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Bean (cm)" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Pea (cm)" })).toBeVisible();

  const readout = page.locator(".point-readout");
  await readout.focus();
  await page.keyboard.press("ArrowRight");
  await expect(readout).toContainText("Bean — Medium — 14 cm — point 2 of 4");

  const series = page.getByRole("combobox", { name: "Series" });
  await series.focus();
  await page.keyboard.press("ArrowDown");
  await expect(series).toHaveValue("1");
  await expect(readout).toContainText("Pea — Low — 6 cm — point 1 of 4");
  await expect(page.getByRole("button", { name: "Previous point" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Next point" })).toBeEnabled();
});

test("reads branch and cycle process samples with keyboard navigation", async ({
  page,
}) => {
  await page.goto("/create");

  const processMode = page.getByRole("radio", { name: /^Process diagram/ });
  await processMode.focus();
  await page.keyboard.press("Space");
  await expect(processMode).toBeChecked();

  const sample = page.getByRole("combobox", { name: "Built-in process" });
  await expect(sample).toHaveValue("process-01");
  const open = page.getByRole("button", { name: "Open" });
  await open.focus();
  await page.keyboard.press("Enter");

  await expect(
    page.getByRole("heading", { name: "Review the extracted lesson" }),
  ).toBeFocused();
  await expect(
    page.getByRole("heading", { name: "Seed germination: parallel growth" }),
  ).toBeVisible();
  await expect(page.getByRole("list", { name: "Process reading order" })).toBeVisible();
  await expect(page.locator(".process-order > ol > li")).toHaveCount(5);
  await expect(
    page.getByText(/does not imply that there is only one next step/i),
  ).toBeVisible();

  const waterNode = page.locator(".process-node").filter({
    has: page.getByRole("heading", { level: 4, name: "Absorbs water" }),
  });
  await expect(
    waterNode.getByRole("link", { name: "Branch option: Root emerges" }),
  ).toBeVisible();
  await expect(
    waterNode.getByRole("link", { name: "Branch option: Shoot emerges" }),
  ).toBeVisible();

  const rootJump = waterNode.getByRole("link", {
    name: "Branch option: Root emerges",
  });
  await rootJump.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { level: 4, name: "Root emerges" }),
  ).toBeFocused();

  const explorer = page.locator(".process-explorer");
  const next = explorer.getByRole("button", { name: "Next node" });
  await next.focus();
  await page.keyboard.press("Enter");
  await expect(explorer.locator(".process-position")).toHaveText("Node 2 of 5");
  await expect(explorer.locator(".process-current-label")).toHaveText(
    "Absorbs water",
  );
  await expect(explorer.getByRole("button", { name: "Previous node" })).toBeEnabled();

  await sample.selectOption("process-02");
  await open.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Review the extracted lesson" }),
  ).toBeFocused();
  await expect(page.getByRole("heading", { name: "Water cycle" })).toBeVisible();
  await expect(page.locator(".process-order > ol > li")).toHaveCount(4);
  await expect(page.getByText(/last listed node is not an ending/i)).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Loops back to: Evaporation" }),
  ).toHaveAttribute("href", "#process-node-evaporation");
  await expect(page.getByRole("tree")).toHaveCount(0);
  await expect(page.locator('[role="application"]')).toHaveCount(0);
});

test("completes teacher verification and eligibility entirely by keyboard", async ({
  page,
}) => {
  await page.goto("/create");

  const sample = page.getByRole("combobox", { name: "Built-in chart" });
  await sample.focus();
  await page.keyboard.press("End");
  await expect(sample).toHaveValue("chart-review-01");
  const open = page.getByRole("button", { name: "Open" });
  await open.focus();
  await page.keyboard.press("Enter");

  await expect(
    page.getByRole("heading", { name: "Review the extracted lesson" }),
  ).toBeFocused();
  const exportButton = page.getByRole("button", { name: "Export lesson" });
  await expect(exportButton).toBeDisabled();
  await expect(
    page.getByText("Every critical review item must be resolved."),
  ).toBeVisible();

  const blocker = page.getByRole("link", { name: "Go to the first blocker" });
  await blocker.focus();
  await page.keyboard.press("Enter");
  const itemHeading = page.getByRole("heading", {
    level: 4,
    name: "Visits — Mar — numeric value",
  });
  await expect(itemHeading).toBeFocused();

  const value = page.getByRole("textbox", {
    name: "Visits — Mar — numeric value",
  });
  await page.keyboard.press("Tab");
  await expect(value).toBeFocused();
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Backspace");
  await expect(value).toHaveAccessibleDescription("Enter a finite number.");

  const valueItem = itemHeading.locator("xpath=ancestor::article");
  const valueResolve = valueItem.getByRole("button", { name: "Mark resolved" });
  await valueResolve.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("review-announcement")).toHaveText(
    "Enter a finite number.",
  );

  await value.focus();
  await page.keyboard.type("145");
  await expect(page.locator(".review-summary dd").first()).toHaveText("2");
  await valueResolve.focus();
  await page.keyboard.press("Enter");

  const trendHeading = page.getByRole("heading", { level: 4, name: "Trend 1" });
  const trendItem = trendHeading.locator("xpath=ancestor::article");
  const trendResolve = trendItem.getByRole("button", { name: "Mark resolved" });
  await trendResolve.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".review-summary dd").first()).toHaveText("0");
  await expect(page.getByText("Teacher acknowledgement is required.")).toBeVisible();

  const acknowledgement = page.getByRole("checkbox", {
    name: /I reviewed the extracted values, labels, order, and relationships/,
  });
  await acknowledgement.focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("heading", { name: "Review complete" })).toBeVisible();
  await expect(exportButton).toBeDisabled();

  await value.focus();
  await page.keyboard.press("Control+A");
  await page.keyboard.type("146");
  await expect(acknowledgement).not.toBeChecked();
  await expect(page.locator(".review-summary dd").first()).toHaveText("2");
  await expect(valueItem.getByRole("button", { name: "Mark resolved" })).toBeVisible();
  await expect(trendItem.getByRole("button", { name: "Mark resolved" })).toBeVisible();
  await expect(page.getByTestId("review-announcement")).toHaveCount(1);
});

test("sonifies one chart series only after keyboard activation and cancels cleanly", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const audit = {
      closes: 0,
      contexts: 0,
      immediateStops: 0,
      resumes: 0,
      scheduledStarts: 0,
      scheduledStops: 0,
    };
    Object.assign(window, { __optiqAudioAudit: audit });

    class FakeAudioParam {
      linearRampToValueAtTime(): FakeAudioParam {
        return this;
      }

      setValueAtTime(): FakeAudioParam {
        return this;
      }
    }

    class FakeOscillator {
      readonly frequency = new FakeAudioParam();
      onended: (() => void) | null = null;
      type = "sine";

      connect(): void {}
      disconnect(): void {}
      start(): void {
        audit.scheduledStarts += 1;
      }
      stop(time?: number): void {
        if (typeof time === "number") audit.scheduledStops += 1;
        else audit.immediateStops += 1;
      }
    }

    class FakeGain {
      readonly gain = new FakeAudioParam();
      connect(): void {}
      disconnect(): void {}
    }

    class FakeAudioContext {
      readonly currentTime = 0;
      readonly destination = {};
      state = "suspended";

      constructor() {
        audit.contexts += 1;
      }

      close(): Promise<void> {
        audit.closes += 1;
        this.state = "closed";
        return Promise.resolve();
      }

      createGain(): FakeGain {
        return new FakeGain();
      }

      createOscillator(): FakeOscillator {
        return new FakeOscillator();
      }

      resume(): Promise<void> {
        audit.resumes += 1;
        this.state = "running";
        return Promise.resolve();
      }
    }

    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      value: FakeAudioContext,
    });
  });

  await page.goto("/create");
  await page.getByRole("button", { name: "Open" }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("table", {
      name: "Plant height by light condition — exact values",
    }),
  ).toBeVisible();
  await page.clock.install();

  const audioAudit = () =>
    page.evaluate(
      () =>
        (window as unknown as Window & {
          __optiqAudioAudit: {
            closes: number;
            contexts: number;
            immediateStops: number;
            resumes: number;
            scheduledStarts: number;
            scheduledStops: number;
          };
        }).__optiqAudioAudit,
    );
  expect((await audioAudit()).contexts).toBe(0);

  const status = page.getByTestId("sonification-status");
  const play = page.getByRole("button", { name: "Play series" });
  await play.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Restart series" })).toBeFocused();
  await expect(page.getByRole("button", { name: "Stop" })).toBeEnabled();
  await expect(status).toContainText("Playing Bean — point 1 of 4.");
  expect(await audioAudit()).toMatchObject({
    contexts: 1,
    resumes: 1,
    scheduledStarts: 4,
    scheduledStops: 4,
  });

  await page.clock.fastForward(
    SONIFICATION_TIMING.toneDurationMs + SONIFICATION_TIMING.gapMs,
  );
  await expect(status).toContainText("Playing Bean — point 2 of 4.");
  await expect(page.getByTestId("point-announcement")).toHaveText("");
  await expect(page.getByTestId("audio-announcement")).toHaveText(
    "Playback started for Bean.",
  );

  await page.getByRole("button", { name: "Restart series" }).focus();
  await page.keyboard.press("Enter");
  await expect(status).toContainText("Playing Bean — point 1 of 4.");
  await expect(page.getByTestId("audio-announcement")).toHaveText(
    "Playback restarted for Bean.",
  );
  expect((await audioAudit()).contexts).toBe(1);
  expect((await audioAudit()).immediateStops).toBeGreaterThanOrEqual(4);

  const stop = page.getByRole("button", { name: "Stop" });
  await stop.focus();
  await page.keyboard.press("Enter");
  await expect(stop).toBeDisabled();
  await expect(status).toHaveText("Playback stopped.");
  await expect(page.getByTestId("audio-announcement")).toHaveText(
    "Playback stopped.",
  );

  await page.getByRole("button", { name: "Play series" }).focus();
  await page.keyboard.press("Enter");
  const series = page.getByRole("combobox", { name: "Series" });
  await series.focus();
  await page.keyboard.press("ArrowDown");
  await expect(series).toHaveValue("1");
  await expect(status).toHaveText("Ready to play Pea.");
  await expect(page.getByTestId("audio-announcement")).toHaveText("");
  await expect(page.getByRole("button", { name: "Stop" })).toBeDisabled();

  await page.getByRole("button", { name: "Play series" }).focus();
  await page.keyboard.press("Enter");
  const processMode = page.getByRole("radio", { name: /^Process diagram/ });
  await processMode.focus();
  await page.keyboard.press("Space");
  await expect(processMode).toBeChecked();
  await expect(page.getByTestId("sonification-status")).toHaveCount(0);
  expect((await audioAudit()).closes).toBe(1);

  const chartMode = page.getByRole("radio", { name: /^Chart/ });
  await chartMode.focus();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "Open" }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Play series" }).focus();
  await page.keyboard.press("Enter");
  await page
    .getByLabel("Image file")
    .setInputFiles(resolve("fixtures/images/chart-bar-01.png"));
  await expect(page.getByTestId("sonification-status")).toHaveCount(0);
  expect((await audioAudit()).closes).toBe(2);

  await page.getByRole("button", { name: "Open" }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Play series" }).focus();
  await page.keyboard.press("Enter");
  await page
    .getByRole("navigation", { name: "Primary navigation" })
    .getByRole("link", { name: "Examples" })
    .click();
  await expect(page).toHaveURL(/\/examples$/);
  await expect(page.getByTestId("sonification-status")).toHaveCount(0);
  expect((await audioAudit()).closes).toBe(3);
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

test("reflows the teacher review at mobile and 200 percent equivalent widths", async ({
  page,
}) => {
  for (const width of [640, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/create");
    await page
      .getByRole("combobox", { name: "Built-in chart" })
      .selectOption("chart-review-01");
    await page.getByRole("button", { name: "Open", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Review the extracted lesson" }),
    ).toBeVisible();

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    const undersizedReviewTargets = await page.evaluate(() =>
      Array.from(
        document.querySelectorAll<HTMLElement>(
          ".teacher-review a, .teacher-review button, .teacher-review input:not([type='checkbox']), .teacher-review select, .teacher-review summary, .review-acknowledgement label",
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

    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
    expect(undersizedReviewTargets).toEqual([]);
    await expect(page.getByRole("button", { name: "Export lesson" })).toBeVisible();
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

  await page.goto("/create");
  await page.getByRole("button", { name: "Open" }).click();
  const cursorTransitionMilliseconds = await page
    .locator(".point-readout")
    .evaluate((element) => {
      const duration = getComputedStyle(element).transitionDuration.split(",")[0]!;
      return duration.endsWith("ms")
        ? Number.parseFloat(duration)
        : Number.parseFloat(duration) * 1000;
    });
  expect(cursorTransitionMilliseconds).toBeLessThanOrEqual(0.01);
});
